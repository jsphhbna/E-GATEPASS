export const PLACEHOLDERS = {
  // TODO: confirm with the school
  kioskLocation: "[KIOSK LOCATION: to be confirmed]",
  entryGateName: "[ENTRY GATE NAME: to be confirmed]",
  exitGateName: "[EXIT GATE NAME: to be confirmed]",
  openingTime: "[OPENING TIME]",
  closingTime: "[CLOSING TIME]",
  acceptedIds: "[ACCEPTED IDS: to be confirmed with the school]",
  retentionDays: "[RETENTION DAYS]",
  creditLine: "[TEAM / ADVISER CREDIT: to be confirmed]"
};

export const LANDING_CONTENT = {
  header: {
    title: "E-GatePass",
    subtitle: "EARIST",
    navLinks: [
      { label: "What is it", href: "#what-is-it" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Where to go", href: "#where-to-go" },
      { label: "FAQ", href: "#faq" }
    ],
    cta: "Get Your Gate Pass"
  },
  hero: {
    eyebrow: "Eulogio \"Amang\" Rodriguez Institute of Science and Technology",
    title: "EARIST E-GatePass",
    subtitle: "A faster, safer way to visit the campus. Generate your QR gate pass online, scan it at the gate, and you're set. No account needed.",
    ctaPrimary: "Get Your Gate Pass",
    ctaSecondary: "How it works",
    features: "No account needed · Works on your phone"
  },
  whatIsIt: {
    heading: "What is E-GatePass?",
    description: "E-GatePass is EARIST's QR code-based visitor management system. Instead of writing your details in a logbook at the gate, you generate a QR gate pass online and scan it when you enter and leave. A guard checks your photo and ID before letting you in, and your entry and exit times are recorded automatically.",
    cards: [
      { title: "No account needed", text: "Fill in a short form. No sign-up, no password." },
      { title: "QR entry and exit", text: "One QR code for your visit. Scan in, scan out." },
      { title: "Guard-verified", text: "A guard compares your ID, photo, and you in person before approving." },
      { title: "Private by design", text: "Your photo and ID are viewable only by authorized staff." }
    ]
  },
  howItWorks: {
    heading: "How to get in: 5 simple steps",
    steps: [
      {
        number: 1,
        group: "Before you arrive",
        title: "Fill in your details",
        text: "Tap \"Get Your Gate Pass.\" Enter your name, contact number, and purpose of visit, and choose your visit date."
      },
      {
        number: 2,
        group: "Before you arrive",
        title: "Add your photo and ID",
        text: "Take a photo of your face and upload a valid ID. Agree to the Data Privacy notice to continue."
      },
      {
        number: 3,
        group: "Before you arrive",
        title: "Save your QR code",
        text: "Your QR code appears right away. Download it or take a screenshot. No phone? Use the kiosk at the gate to print your pass."
      },
      {
        number: 4,
        group: "At the gate",
        title: "Scan at the entry tablet",
        text: "Show your QR code to the camera. Wait while the guard checks your ID and photo. The screen will say \"Approved, you may enter\" or \"Entry not approved, please see the guard.\""
      },
      {
        number: 5,
        group: "When you leave",
        title: "Scan at the exit tablet",
        text: "Scan the same QR code on your way out. Your exit is recorded and your visit is complete."
      }
    ],
    prepare: "A smartphone with a camera (or use the kiosk) · A valid ID · Your QR code, downloaded or in a screenshot."
  },
  whyExit: {
    heading: "Why do I need to scan out?",
    intro: "Scanning out takes a few seconds and it matters.",
    points: [
      { title: "It closes your visit.", text: "Your time-out is recorded, so the system knows you have left." },
      { title: "It keeps everyone safe.", text: "In an emergency, security uses the list of people still inside the campus to account for everyone." },
      { title: "It keeps records accurate.", text: "Entry and exit times are used for daily visitor reports." },
      { title: "It protects your pass.", text: "A pass that has been used to exit cannot be reused. Coming back later means generating a new QR code." }
    ],
    closing: "Forgot to scan out? Tell the guard before you leave."
  },
  whereToGo: {
    heading: "Where to go",
    cards: [
      {
        title: "Get your pass",
        text: "Anywhere, on your phone, using this website. Or use the kiosk at the gate to get a printed pass.",
        location: `Location: ${PLACEHOLDERS.kioskLocation}`
      },
      {
        title: "Entry scan",
        text: "Scan your QR at the entry tablet, then wait for the guard's decision.",
        location: `Location: ${PLACEHOLDERS.entryGateName}`
      },
      {
        title: "Exit scan",
        text: "Scan your QR at the exit tablet when you leave.",
        location: `Location: ${PLACEHOLDERS.exitGateName}`
      }
    ],
    validity: `Your pass works on your chosen visit date during campus hours, ${PLACEHOLDERS.openingTime} to ${PLACEHOLDERS.closingTime}.`
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      { q: "Do I need an account?", a: "No. You only fill in a short form. There is no sign-up and no password." },
      { q: "Why do you need my photo and ID?", a: "So the guard can confirm who you are before you enter. The guard compares your ID, your photo, and you in person. Your photo and ID are used only for this and can be viewable only by authorized staff." },
      { q: "What ID can I use?", a: `Please use a valid ID that shows your name and photo. ${PLACEHOLDERS.acceptedIds}` },
      { q: "How long is my QR code valid?", a: "It is valid on the visit date you chose, during campus hours. After that it expires and cannot be used." },
      { q: "What happens after I scan at the entry tablet?", a: "The guard sees your details and photo and approves or rejects your entry. The tablet then shows \"Approved, you may enter\" or \"Entry not approved, please see the guard.\" Reasons are not shown on the tablet. The guard will explain in person." },
      { q: "My scan was not accepted. What does it mean?", a: "The tablet may say \"QR code not recognized,\" \"QR code expired or not valid at this time,\" \"QR code already used,\" or \"Already scanned, please wait for the guard.\" Please proceed to the guard for help." },
      { q: "Can I leave and come back later the same day?", a: "Yes, but each entry needs a QR code that has not been used. After you exit, generate a new pass for your next entry." },
      { q: "I forgot to scan out. What should I do?", a: "Tell the guard. Until an exit is recorded, your visit shows as still inside the campus." },
      { q: "What if the system is down?", a: "Guards will record visitors in a manual logbook until the system is back." },
      { q: "Is my information safe?", a: "Yes. Your details are handled in line with the Data Privacy Act of 2012. See \"Your privacy\" below." }
    ]
  },
  privacy: {
    heading: "Your privacy",
    intro: "E-GatePass collects only what is needed to verify visitors and keep a record of who is on campus.",
    list: [
      { term: "What we collect:", def: "Name, contact number, purpose of visit, face photo, ID image, and your entry and exit times." },
      { term: "Why:", def: "To verify your identity and keep campus safe and records accurate." },
      { term: "Who can see it:", def: "Authorized security staff and administrators only." },
      { term: "How long we keep images:", def: `Photos and ID images are deleted after ${PLACEHOLDERS.retentionDays} days.` }
    ],
    closing: "Handled in line with the Data Privacy Act of 2012 (Republic Act No. 10173)."
  },
  finalCta: {
    heading: "Ready to visit EARIST?",
    cta: "Get Your Gate Pass"
  },
  footer: {
    officialName: "EULOGIO \"AMANG\" RODRIGUEZ INSTITUTE OF SCIENCE AND TECHNOLOGY",
    contact: "Nagtahan St, Sampaloc, Manila, 1008 Metro Manila · earistofficial1945@gmail.com · (028) 243-9467",
    websiteLink: { text: "Visit the official EARIST website", href: "https://earist.edu.ph" },
    smallPrint: `E-GatePass is a capstone project. ${PLACEHOLDERS.creditLine} · © 2026 EARIST`
  }
};
