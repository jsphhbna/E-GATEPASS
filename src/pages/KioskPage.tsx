import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useWebcam } from '@/hooks/useWebcam';
import { compressImageToWebP, uploadToCloudinary } from '@/lib/cloudinary';
import { toDataURL } from 'qrcode';
import {
  Camera,
  Upload,
  CheckCircle2,
  Printer,
  ArrowRight,
  Shield,
  AlertCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parse, startOfDay, set as setDate } from 'date-fns';

const kioskPassSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name is too long'),
  contactNumber: z
    .string()
    .min(7, 'Contact number must be at least 7 digits')
    .max(15, 'Contact number is too long')
    .regex(/^[0-9+\-() ]+$/, 'Invalid contact number format'),
  purpose: z
    .string()
    .min(3, 'Please describe your purpose')
    .max(300, 'Purpose description is too long'),
  visitDate: z.string().min(1, 'Please select a visit date'),
  consent: z.literal(true, {
    message: 'You must accept the Data Privacy Act notice to proceed',
  }),
});

type KioskPassFormData = z.infer<typeof kioskPassSchema>;

type Step = 'form' | 'photo' | 'id' | 'review' | 'generating' | 'done';

export function KioskPage() {
  const [step, setStep] = useState<Step>('form');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [idBlob, setIdBlob] = useState<Blob | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPeakMode, setIsPeakMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'app')).then((docSnap) => {
      if (docSnap.exists() && docSnap.data().peakMode) {
        setIsPeakMode(true);
      }
    });
  }, []);

  const webcam = useWebcam({ facingMode: 'user' });

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isValid },
  } = useForm<KioskPassFormData>({
    resolver: zodResolver(kioskPassSchema),
    mode: 'onChange',
    defaultValues: {
      visitDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  function onFormNext(data: KioskPassFormData) {
    void data;
    setStep('photo');
    webcam.start();
  }

  function onCapturePhoto() {
    const blob = webcam.capture();
    if (blob) {
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
      webcam.stop();
      if (isPeakMode) {
        setStep('review');
      } else {
        setStep('id');
      }
    } else {
      toast.error('Failed to capture photo.');
    }
  }

  function onRetakePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setStep('photo');
    webcam.start();
  }

  async function onIdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageToWebP(file);
      setIdBlob(compressed);
      setIdPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error('Failed to process ID image.');
    }
  }

  async function onSubmit() {
    if (!photoBlob) {
      toast.error('Photo is required.');
      return;
    }
    if (!isPeakMode && !idBlob) {
      toast.error('ID is required.');
      return;
    }

    setStep('generating');
    setSubmitError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Kiosk device not authenticated');
      const uid = user.uid;

      const uploads = [uploadToCloudinary(photoBlob, 'e-gatepass/photos')];
      if (idBlob) {
        uploads.push(uploadToCloudinary(idBlob, 'e-gatepass/ids'));
      }
      const [photoPublicId, idImagePublicId] = await Promise.all(uploads);

      const formData = getValues();
      const visitorRef = doc(collection(db, 'visitors'));
      const visitorId = visitorRef.id;

      await setDoc(visitorRef, {
        fullName: formData.fullName,
        contactNumber: formData.contactNumber,
        purpose: formData.purpose,
        visitDate: formData.visitDate,
        idImagePublicId: idImagePublicId || null,
        photoPublicId,
        consentAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        createdByUid: uid, // kiosk device uid
        imagesPurgedAt: null,
      });

      const visitDateParsed = parse(formData.visitDate, 'yyyy-MM-dd', new Date());
      const dayStart = startOfDay(visitDateParsed);
      const validFrom = setDate(dayStart, { hours: 8, minutes: 0 });
      const validUntil = setDate(dayStart, { hours: 17, minutes: 0 });

      const gatePassRef = doc(collection(db, 'gatePasses'));
      const gatePassId = gatePassRef.id;

      await setDoc(gatePassRef, {
        visitorId,
        visitorName: formData.fullName,
        purpose: formData.purpose,
        photoPublicId,
        source: 'kiosk',
        status: 'issued', // walk-ins go to 'issued', entry scanner makes them 'pending'
        validFrom: Timestamp.fromDate(validFrom),
        validUntil: Timestamp.fromDate(validUntil),
        issuedAt: serverTimestamp(),
        scannedAt: null,
        timeIn: null,
        timeOut: null,
        entryDeviceId: null,
        exitDeviceId: null,
        decidedByUid: null,
        rejectionReason: null,
        gate: null,
        createdByUid: uid,
      });

      const qrUrl = await toDataURL(gatePassId, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });

      setQrDataUrl(qrUrl);
      setStep('done');
      toast.success('Pass generated!');
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to generate pass.');
      setStep('review');
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleNextVisitor() {
    reset();
    setPhotoBlob(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setIdBlob(null);
    if (idPreview) URL.revokeObjectURL(idPreview);
    setIdPreview(null);
    setQrDataUrl(null);
    setStep('form');
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-start px-4 py-8"
      style={{ backgroundColor: 'var(--color-canvas)' }}
    >
      <div className="w-full max-w-lg print:w-full print:max-w-none print:p-0">
        
        {/* Header - Hidden on print */}
        <div className="mb-6 text-center print:hidden">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--color-brand-light)' }}
          >
            <Shield className="h-6 w-6" style={{ color: 'var(--color-brand)' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Walk-in Registration Kiosk
          </h1>
        </div>

        {/* Card container */}
        <div
          className="rounded-xl p-6 print:shadow-none print:p-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {step === 'form' && (
            <form onSubmit={handleSubmit(onFormNext)} className="space-y-4" noValidate>
              <div>
                <label className="mb-1 block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  {...register('fullName')}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
                {errors.fullName && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Contact Number</label>
                <input
                  type="tel"
                  {...register('contactNumber')}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
                {errors.contactNumber && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.contactNumber.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Purpose</label>
                <textarea
                  {...register('purpose')}
                  rows={3}
                  className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
                />
                {errors.purpose && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.purpose.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Visit Date</label>
                <input
                  type="date"
                  {...register('visitDate')}
                  min={today}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" {...register('consent')} className="mt-0.5" />
                  <span>
                    I consent to the collection and processing of my personal information in accordance with the Data Privacy Act of 2012 (RA 10173).
                  </span>
                </label>
                {errors.consent && (
                  <p className="mt-1 text-xs text-red-500">{errors.consent.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!isValid}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next: Take Photo
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === 'photo' && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-semibold">Take Your Photo</h2>
              <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg bg-black">
                <video ref={webcam.videoRef} autoPlay playsInline muted className="h-full w-full object-cover -scale-x-100" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('form')} className="flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium">
                  Back
                </button>
                <button type="button" onClick={onCapturePhoto} disabled={!webcam.isActive} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  <Camera className="h-4 w-4" />
                  Capture
                </button>
              </div>
            </div>
          )}

          {step === 'id' && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-semibold">Upload ID</h2>
              {idPreview ? (
                <div className="space-y-3">
                  <div className="relative mx-auto max-w-xs overflow-hidden rounded-lg">
                    <img src={idPreview} alt="ID preview" className="w-full" />
                    <button type="button" onClick={() => setIdPreview(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={onRetakePhoto} className="flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium">
                      Retake Photo
                    </button>
                    <button type="button" onClick={() => setStep('review')} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                      Review
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className="flex aspect-[3/2] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mb-2 h-8 w-8 text-gray-400" />
                    <span className="text-sm font-medium">Tap to upload ID</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={onIdFileChange} className="hidden" />
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-semibold">Review Pass</h2>
              {submitError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{submitError}</div>}
              
              <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800">
                <p><strong>Name:</strong> {getValues('fullName')}</p>
                <p><strong>Purpose:</strong> {getValues('purpose')}</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => {
                  if (isPeakMode) {
                    setStep('photo');
                  } else {
                    setStep('id');
                  }
                }} className="flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium">
                  Back
                </button>
                <button type="button" onClick={onSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white">
                  Generate
                </button>
              </div>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-sm font-medium">Generating gate pass…</p>
            </div>
          )}

          {step === 'done' && qrDataUrl && (
            <div className="space-y-4 text-center print:text-left print:m-0">
              <div className="print:hidden mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              
              <h2 className="text-lg font-bold">Gate Pass (Walk-in)</h2>

              <div className="mx-auto inline-block rounded-lg bg-white p-4 print:mx-0 print:p-0">
                <img src={qrDataUrl} alt="QR Code" className="h-64 w-64 print:h-48 print:w-48" />
              </div>

              <div className="rounded-md bg-gray-50 p-3 text-left text-sm dark:bg-gray-800 print:bg-transparent print:p-0">
                <p><strong>Name:</strong> {getValues('fullName')}</p>
                <p><strong>Date:</strong> {getValues('visitDate')}</p>
                <p><strong>Purpose:</strong> {getValues('purpose')}</p>
                <p><strong>Valid:</strong> 08:00 AM – 05:00 PM</p>
              </div>

              <div className="flex gap-2 print:hidden">
                <button type="button" onClick={handlePrint} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white">
                  <Printer className="h-4 w-4" /> Print Pass
                </button>
                <button type="button" onClick={handleNextVisitor} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                  Next Visitor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
