import { useState, useMemo, useEffect, useRef } from "react";

// Earthy Harmony palette
const C = {
  mint: "#CBDED3",       // soft mint
  sage: "#8BA49A",       // muted sage
  sand: "#D2C49E",       // warm sand
  forest: "#3B6255",     // deep forest
  bone: "#E2DFDA",       // bone / oatmeal
  // Derived
  forestDark: "#2A4A40",
  forestDarker: "#1F3830",
  sageDark: "#6F8B80",
  sandDark: "#B8A87F",
  bodyText: "#2F2E2B",
  mutedText: "#6B6A65",
  lightBg: "#F7F5F0",
  cardBorder: "#E5DFD4",
};

export default function LoanCalculator() {
  const [step, setStep] = useState("input");
  const [selectedStructure, setSelectedStructure] = useState(null);

  // Hidden constant: Vu's WhatsApp number, never displayed in the UI.
  // Used only when building wa.me deep links on user action.
  const VU_PHONE = "6591179540";

  // INPUTS
  const [propertyValue, setPropertyValue] = useState(null);
  const [ltvRatio, setLtvRatio] = useState(0.85);
  const [outstanding, setOutstanding] = useState(null);
  const [cpfPrincipal, setCpfPrincipal] = useState(null);

  const [proposedLoan, setProposedLoan] = useState(null);
  const [userEditedLoan, setUserEditedLoan] = useState(false);

  const [interestRate, setInterestRate] = useState(0.0675);
  const [processingFeePct, setProcessingFeePct] = useState(0.02);

  const [fireInsurance, setFireInsurance] = useState(500);
  const [legalFee, setLegalFee] = useState(5000);
  const [valuationFee, setValuationFee] = useState(1000);

  const [amortYears, setAmortYears] = useState(30);
  const BALLOON_YEAR = 5;

  const [showSchedule, setShowSchedule] = useState(null);
  const [compareFeesOpen, setCompareFeesOpen] = useState(false);

  const n = (v) => (v == null || v === "" || isNaN(v) ? 0 : Number(v));
  const round2 = (x) => Math.round(x * 100) / 100;

  // CPF projections per repayment structure
  const cpfProjected = (months) => {
    const principal = n(cpfPrincipal);
    const interest = (principal * 0.025 * months) / 12;
    const total = principal + interest;
    return Math.ceil(total / 1000) * 1000;
  };
  const cpfIOnly = useMemo(() => cpfProjected(12), [cpfPrincipal]);
  const cpfBalloon = useMemo(() => cpfProjected(3), [cpfPrincipal]);

  // Current LTV = (Outstanding + CPF) / Property Value
  // CPF counts as a claim on the property since it's not redeemed.
  const currentLtv =
    n(propertyValue) > 0
      ? (n(outstanding) + n(cpfPrincipal)) / n(propertyValue)
      : 0;

  // Tiered suggestion (Option B):
  //   Current LTV 70% to 75%   -> suggest at 80% LTV
  //   Otherwise                -> suggest at 75% LTV
  // The suggested loan is now Property × tier directly (without CPF deduction)
  // because CPF is now shown explicitly on the Proposal page. This way the
  // Proposed LTV displayed on Step 1 lands cleanly on the tier value.
  const suggestedLtvTier =
    currentLtv >= 0.70 && currentLtv <= 0.75 ? 0.80 : 0.75;

  const suggestedLoan = Math.max(0, n(propertyValue) * suggestedLtvTier);

  const effectiveProposedLoan =
    userEditedLoan && proposedLoan != null ? n(proposedLoan) : suggestedLoan;

  // Proposed LTV on the input page is now clean: just Loan / Property.
  // CPF impact is shown as an explicit deduction on Step 3 (Proposal).
  const proposedLtv =
    n(propertyValue) > 0 ? effectiveProposedLoan / n(propertyValue) : 0;

  const handleProposedLoanChange = (v) => {
    setProposedLoan(v);
    setUserEditedLoan(true);
  };
  const resetProposedLoan = () => {
    setUserEditedLoan(false);
    setProposedLoan(null);
  };

  // The proposed loan as entered (before CPF deduction)
  const loan = effectiveProposedLoan;

  // Per-structure applicable loan = proposed loan minus structure's CPF projection.
  // This is what actually gets disbursed.
  const applicableLoanIOnly = Math.max(0, loan - cpfIOnly);
  const applicableLoanBalloon = Math.max(0, loan - cpfBalloon);

  // Per-structure processing fee (capped at 3%, calculated on applicable loan)
  const cappedProcessingFeePct = Math.min(n(processingFeePct), 0.03);
  const processingFeeIOnly = round2(applicableLoanIOnly * cappedProcessingFeePct);
  const processingFeeBalloon = round2(applicableLoanBalloon * cappedProcessingFeePct);

  const monthlyRate = n(interestRate) / 12;

  // Per-structure monthly servicing amounts
  const iOnlyMonthly = round2(applicableLoanIOnly * monthlyRate);
  const iOnlyEndOfTerm = applicableLoanIOnly;

  const amortMonths = n(amortYears) * 12;
  const balloonMonths = BALLOON_YEAR * 12;

  const balloonMonthly = round2(
    monthlyRate === 0 || amortMonths === 0
      ? applicableLoanBalloon / (amortMonths || 1)
      : (applicableLoanBalloon * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -amortMonths))
  );

  const balloonEndBalance = round2(
    monthlyRate === 0
      ? applicableLoanBalloon - balloonMonthly * balloonMonths
      : applicableLoanBalloon * Math.pow(1 + monthlyRate, balloonMonths) -
          balloonMonthly *
            ((Math.pow(1 + monthlyRate, balloonMonths) - 1) / monthlyRate)
  );

  // Per-structure cashout = applicable loan − outstanding − processing − fire insurance
  const cashoutIOnly = round2(
    applicableLoanIOnly - n(outstanding) - processingFeeIOnly - n(fireInsurance)
  );
  const cashoutBalloon = round2(
    applicableLoanBalloon - n(outstanding) - processingFeeBalloon - n(fireInsurance)
  );

  // Single-structure view convenience: pick based on selectedStructure
  const isBalloon = selectedStructure === "balloon";
  const applicableLoan = isBalloon ? applicableLoanBalloon : applicableLoanIOnly;
  const processingFee = isBalloon ? processingFeeBalloon : processingFeeIOnly;
  const cashout = isBalloon ? cashoutBalloon : cashoutIOnly;
  const cpfForStructure = isBalloon ? cpfBalloon : cpfIOnly;

  const iOnlySchedule = useMemo(() => {
    const rows = [];
    for (let m = 1; m <= 12; m++) {
      rows.push({
        month: m,
        begin: applicableLoanIOnly,
        interest: iOnlyMonthly,
        principal: m === 12 ? applicableLoanIOnly : 0,
        end: m === 12 ? 0 : applicableLoanIOnly,
      });
    }
    return rows;
  }, [applicableLoanIOnly, iOnlyMonthly]);

  const balloonSchedule = useMemo(() => {
    const rows = [];
    let balance = applicableLoanBalloon;
    for (let m = 1; m <= balloonMonths; m++) {
      const interest = round2(balance * monthlyRate);
      let principal = round2(balloonMonthly - interest);
      let end = round2(balance - principal);
      if (m === balloonMonths) {
        principal = balance;
        end = 0;
      }
      rows.push({
        month: m,
        begin: round2(balance),
        interest,
        principal: round2(principal),
        end: round2(end),
      });
      balance = end;
    }
    return rows;
  }, [applicableLoanBalloon, monthlyRate, balloonMonths, balloonMonthly]);

  const fmt = (x) => {
    if (x == null || x === "" || isNaN(x)) return "";
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(x));
  };

  const fmtPct = (x) => {
    if (x == null || isNaN(x)) return "";
    return `${(Number(x) * 100).toFixed(2)}%`;
  };

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        backgroundColor: C.lightBg,
        color: C.bodyText,
        backgroundImage: `radial-gradient(circle at 15% 10%, ${C.mint}40 0%, transparent 35%), radial-gradient(circle at 85% 80%, ${C.sand}30 0%, transparent 40%)`,
      }}
    >
      <header
        className="border-b bg-white/70 backdrop-blur-sm"
        style={{ borderColor: C.cardBorder }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div>
              <h1
                className="text-2xl tracking-tight leading-none"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: C.forestDark,
                }}
              >
                VuCalc<span style={{ color: C.sage, fontStyle: "italic" }}>+</span>
              </h1>
              <p
                className="text-xs mt-1"
                style={{ color: C.mutedText, fontStyle: "italic" }}
              >
                Property-secured financing, thoughtfully structured
              </p>
            </div>
          </div>
          <StepIndicator step={step} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Disclaimer: warmer, advisor tone */}
        <div
          className="mb-6 rounded-lg px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm leading-relaxed flex items-start gap-2 sm:gap-3"
          style={{
            backgroundColor: `${C.mint}60`,
            border: `1px solid ${C.sage}40`,
            color: C.forestDarker,
          }}
        >
          <LeafIcon color={C.forest} size={18} />
          <div>
            <strong className="font-semibold">Disclaimer.</strong>{" "}
            The figures shown are indicative only. For a tailored proposal, please contact Vu directly. All applications are subject to credit assessment and approval.
          </div>
        </div>

        {step === "input" && (
          <InputStep
            propertyValue={propertyValue}
            setPropertyValue={setPropertyValue}
            ltvRatio={ltvRatio}
            setLtvRatio={setLtvRatio}
            outstanding={outstanding}
            setOutstanding={setOutstanding}
            currentLtv={currentLtv}
            cpfPrincipal={cpfPrincipal}
            setCpfPrincipal={setCpfPrincipal}
            cpfIOnly={cpfIOnly}
            interestRate={interestRate}
            setInterestRate={setInterestRate}
            processingFeePct={processingFeePct}
            setProcessingFeePct={setProcessingFeePct}
            fireInsurance={fireInsurance}
            setFireInsurance={setFireInsurance}
            legalFee={legalFee}
            setLegalFee={setLegalFee}
            valuationFee={valuationFee}
            setValuationFee={setValuationFee}
            proposedLoan={effectiveProposedLoan}
            suggestedLoan={suggestedLoan}
            suggestedLtvTier={suggestedLtvTier}
            userEditedLoan={userEditedLoan}
            onProposedLoanChange={handleProposedLoanChange}
            onResetLoan={resetProposedLoan}
            proposedLtv={proposedLtv}
            fmt={fmt}
            fmtPct={fmtPct}
            onNext={() => setStep("select")}
          />
        )}

        {step === "select" && (
          <SelectStep
            onBack={() => setStep("input")}
            onSelect={(s) => {
              setSelectedStructure(s);
              setStep("results");
            }}
          />
        )}

        {step === "results" && (
          <ResultsStep
            selectedStructure={selectedStructure}
            proposedLoan={loan}
            applicableLoan={applicableLoan}
            applicableLoanIOnly={applicableLoanIOnly}
            applicableLoanBalloon={applicableLoanBalloon}
            cpfPrincipal={n(cpfPrincipal)}
            cpfIOnly={cpfIOnly}
            cpfBalloon={cpfBalloon}
            cpfForStructure={cpfForStructure}
            outstanding={n(outstanding)}
            processingFee={processingFee}
            processingFeeIOnly={processingFeeIOnly}
            processingFeeBalloon={processingFeeBalloon}
            fireInsurance={n(fireInsurance)}
            legalFee={n(legalFee)}
            valuationFee={n(valuationFee)}
            cashout={cashout}
            cashoutIOnly={cashoutIOnly}
            cashoutBalloon={cashoutBalloon}
            interestRate={n(interestRate)}
            iOnlyMonthly={iOnlyMonthly}
            iOnlyEndOfTerm={iOnlyEndOfTerm}
            balloonMonthly={balloonMonthly}
            balloonEndBalance={balloonEndBalance}
            amortYears={amortYears}
            setAmortYears={setAmortYears}
            iOnlySchedule={iOnlySchedule}
            balloonSchedule={balloonSchedule}
            balloonMonths={balloonMonths}
            showSchedule={showSchedule}
            setShowSchedule={setShowSchedule}
            compareFeesOpen={compareFeesOpen}
            setCompareFeesOpen={setCompareFeesOpen}
            fmt={fmt}
            fmtPct={fmtPct}
            onBack={() => setStep("select")}
            onRestart={() => {
              setStep("input");
              setShowSchedule(null);
            }}
            onProceed={() => setStep("snapshot")}
          />
        )}

        {step === "snapshot" && (
          <SnapshotStep
            selectedStructure={selectedStructure}
            applicableLoanIOnly={applicableLoanIOnly}
            applicableLoanBalloon={applicableLoanBalloon}
            cashoutIOnly={cashoutIOnly}
            cashoutBalloon={cashoutBalloon}
            iOnlyMonthly={iOnlyMonthly}
            balloonMonthly={balloonMonthly}
            processingFeeIOnly={processingFeeIOnly}
            processingFeeBalloon={processingFeeBalloon}
            fireInsurance={n(fireInsurance)}
            legalFee={n(legalFee)}
            valuationFee={n(valuationFee)}
            interestRate={n(interestRate)}
            fmt={fmt}
            onBack={() => setStep("results")}
            onProceed={() => setStep("next-steps")}
          />
        )}

        {step === "next-steps" && (
          <NextStepsStep
            phone={VU_PHONE}
            selectedStructure={selectedStructure}
            applicableLoanIOnly={applicableLoanIOnly}
            applicableLoanBalloon={applicableLoanBalloon}
            cashoutIOnly={cashoutIOnly}
            cashoutBalloon={cashoutBalloon}
            iOnlyMonthly={iOnlyMonthly}
            balloonMonthly={balloonMonthly}
            fmt={fmt}
            onBack={() => setStep("snapshot")}
          />
        )}
      </main>

      <footer
        className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-xs text-center border-t mt-8 sm:mt-10"
        style={{ color: C.mutedText, borderColor: C.cardBorder }}
      >
        <div className="flex items-center justify-center gap-2">
          <Sprout color={C.sage} size={14} />
          <span>VuCalc+ · Indicative only · Subject to credit approval</span>
        </div>
      </footer>
    </div>
  );
}

// =========================================================
// DECORATIVE ICONS (custom SVG, match the earthy theme)
// =========================================================
function Logo({ size = 44 }) {
  // VuCalc+ logo, inline SVG in Earthy Harmony forest green.
  // Stylized "vu" with motion streaks on the left and a plus mark on top-right.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="vuGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.sage} />
          <stop offset="100%" stopColor={C.forest} />
        </linearGradient>
      </defs>

      {/* Soft rounded background */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="22"
        fill={C.forestDarker}
      />

      {/* Motion streaks (left side) */}
      <rect x="10" y="66" width="10" height="3.5" rx="1.75" fill={C.mint} opacity="0.9" />
      <rect x="14" y="72" width="18" height="3.5" rx="1.75" fill={C.mint} opacity="0.75" />
      <rect x="20" y="78" width="12" height="3.5" rx="1.75" fill={C.mint} opacity="0.6" />

      {/* "V" stroke */}
      <path
        d="M 30 30 L 50 76 L 70 30"
        stroke="url(#vuGrad)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* "u" tail on right, curved hook */}
      <path
        d="M 70 30 L 70 66 Q 70 78 58 78 Q 50 78 50 70"
        stroke="url(#vuGrad)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Plus mark (top-right) */}
      <g>
        <rect x="76" y="18" width="4.5" height="14" rx="2.25" fill={C.mint} />
        <rect x="71.25" y="22.75" width="14" height="4.5" rx="2.25" fill={C.mint} />
      </g>
    </svg>
  );
}

function LeafIcon({ color = C.forest, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
      <path
        d="M20 4 C20 4 6 6 6 14 C6 18 9 20 12 20 C17 20 20 16 20 4 Z M12 20 L8 14"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function Sprout({ color = C.sage, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20 V10 M12 14 C9 14 6 12 6 8 C10 8 12 10 12 14 M12 12 C15 12 18 10 18 6 C14 6 12 8 12 12"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function HouseIcon({ color = C.forest, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11 L12 4 L20 11 V20 H4 Z M10 20 V14 H14 V20"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function CoinsIcon({ color = C.forest, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="9" cy="7" rx="6" ry="2.5" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M3 7 V12 C3 13.4 5.7 14.5 9 14.5 C12.3 14.5 15 13.4 15 12 V7" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="15" rx="6" ry="2.5" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M9 15 V20 C9 21.4 11.7 22.5 15 22.5 C18.3 22.5 21 21.4 21 20 V15" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function DocumentIcon({ color = C.forest, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3 H14 L18 7 V21 H6 Z M14 3 V7 H18" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
      <path d="M9 12 H15 M9 16 H13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PercentIcon({ color = C.forest, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="7" cy="7" r="2.5" stroke={color} strokeWidth="1.6" fill="none" />
      <circle cx="17" cy="17" r="2.5" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M6 18 L18 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ color = C.forest, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M12 7 V12 L15 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TreeIcon({ color = C.forest, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 L6 11 H9 L5 17 H10 V21 H14 V17 H19 L15 11 H18 Z" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ color = C.forest, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22 C12 22 5 14 5 9 A7 7 0 0 1 19 9 C19 14 12 22 12 22 Z" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function MailIcon({ color = C.forest, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M3 7 L12 13 L21 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function WhatsappIcon({ color = C.forest, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 A9 9 0 0 0 3 12 C3 14 3.5 15.5 4.5 17 L3 21 L7.2 19.7 C8.7 20.4 10.3 20.8 12 20.8 A9 9 0 0 0 12 3 Z"
        stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <path d="M8.5 9 C8.5 9 9 13 11 14.5 C13 16 15 15.5 15 15.5 L14 14 L12.5 14.5 C11.5 13.5 10.5 12.5 9.5 11.5 L10 10 L8.5 9 Z"
        fill={color} />
    </svg>
  );
}

function CheckCircleIcon({ color = C.forest, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M8 12 L11 15 L16 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// =========================================================
// STEP INDICATOR
// =========================================================
function StepIndicator({ step }) {
  const steps = [
    { id: "input", label: "Your details" },
    { id: "select", label: "Structure" },
    { id: "results", label: "Proposal" },
    { id: "snapshot", label: "Snapshot" },
    { id: "next-steps", label: "Next steps" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <>
      {/* Mobile: just numbered dots and the current label */}
      <div className="flex sm:hidden items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className="w-2 h-2 rounded-full transition"
              style={{
                backgroundColor: i <= currentIdx ? C.forest : C.bone,
              }}
            />
          ))}
        </div>
        <span style={{ color: C.forestDark, fontWeight: 500 }}>
          Step {currentIdx + 1} of {steps.length}
        </span>
      </div>

      {/* Desktop: full breadcrumb with labels */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs flex-wrap">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center font-medium text-[11px] transition"
              style={{
                backgroundColor: i <= currentIdx ? C.forest : C.bone,
                color: i <= currentIdx ? "white" : C.mutedText,
              }}
            >
              {i + 1}
            </div>
            <span
              style={{
                color: i === currentIdx ? C.forestDark : C.mutedText,
                fontWeight: i === currentIdx ? 500 : 400,
              }}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span style={{ color: C.sage, margin: "0 2px" }}>·</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// =========================================================
// STEP 1: INPUT
// =========================================================
function InputStep({
  propertyValue, setPropertyValue,
  ltvRatio, setLtvRatio,
  outstanding, setOutstanding,
  currentLtv,
  cpfPrincipal, setCpfPrincipal,
  cpfIOnly,
  interestRate, setInterestRate,
  processingFeePct, setProcessingFeePct,
  fireInsurance, setFireInsurance,
  legalFee, setLegalFee,
  valuationFee, setValuationFee,
  proposedLoan, suggestedLoan, suggestedLtvTier, userEditedLoan,
  onProposedLoanChange, onResetLoan,
  proposedLtv,
  fmt, fmtPct, onNext,
}) {
  const hasProperty = Number(propertyValue) > 0;
  const hasOutstanding = Number(outstanding) >= 0 && Number(propertyValue) > 0;

  return (
    <div className="space-y-6">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex-1">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            Let's start with <em style={{ color: C.sage }}>the basics</em>
          </h2>
          <p className="text-sm" style={{ color: C.mutedText }}>
            Share a few details about the property and any existing financing. We'll take it from there.
          </p>
        </div>
        <div className="hidden md:block">
          <TreeIcon color={C.sage} size={56} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Property */}
        <Card title="Property" icon={<HouseIcon color={C.forest} size={18} />}>
          <MoneyInput
            label="Property indicative valuation"
            value={propertyValue}
            onChange={setPropertyValue}
          />
          <MoneyInput
            label="Current outstanding loan (including any caveat loans)"
            value={outstanding}
            onChange={setOutstanding}
          />
          <div className="flex items-start gap-2">
            <div className="pt-6 flex-shrink-0">
              <Sprout color={C.sage} size={16} />
            </div>
            <div className="flex-1">
              <MoneyInput
                label="CPF principal + accrued interest"
                value={cpfPrincipal}
                onChange={setCpfPrincipal}
                optional
              />
            </div>
          </div>
          <div className="mt-2 pt-3" style={{ borderTop: `1px dashed ${C.cardBorder}` }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: C.mutedText }}>Current LTV</span>
              <span className="tabular-nums font-medium" style={{ color: C.forestDark }}>
                {hasOutstanding ? fmtPct(currentLtv) : ""}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: C.mutedText, fontStyle: "italic" }}>
              (Outstanding loan + CPF) as a share of property value
            </p>
          </div>
        </Card>

        {/* Loan terms */}
        <Card title="Loan terms" icon={<PercentIcon color={C.forest} size={18} />}>
          <PercentInput
            label="Interest rate (p.a.)"
            value={interestRate}
            onChange={setInterestRate}
          />
          <PercentInput
            label="Processing fee (deducted from loan)"
            value={processingFeePct}
            onChange={setProcessingFeePct}
            max={0.03}
          />
        </Card>

        {/* Fees */}
        <Card title="Other fees" icon={<CoinsIcon color={C.forest} size={18} />}>
          <MoneyInput
            label="Fire insurance fee (deducted from loan)"
            value={fireInsurance}
            onChange={setFireInsurance}
          />
          <div className="pt-2 mt-2" style={{ borderTop: `1px dashed ${C.cardBorder}` }}>
            <p className="text-xs mb-3 uppercase tracking-wider" style={{ color: C.mutedText }}>
              Paid upfront by client
            </p>
            <MoneyInput label="Legal fee" value={legalFee} onChange={setLegalFee} />
            <MoneyInput label="Valuation fee" value={valuationFee} onChange={setValuationFee} />
          </div>
        </Card>
      </div>

      {/* Proposed Loan (emphasised) */}
      <Card title="Proposed loan amount" accent icon={<CoinsIcon color={C.forest} size={18} />}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <MoneyInput
              label="Amount to structure"
              value={proposedLoan}
              onChange={onProposedLoanChange}
              emphasis
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <PercentInput
              label="Proposed LTV"
              value={hasProperty ? proposedLtv : 0}
              onChange={(v) => {
                // Editing LTV recalculates loan, using the same 12-month
                // projected CPF that drives the display:
                //   (loan + cpfIOnly) / Property = LTV
                //   loan = (LTV × Property) − cpfIOnly
                if (!hasProperty) return;
                const newLoan = Number(propertyValue) * v - Number(cpfIOnly ?? 0);
                onProposedLoanChange(
                  Math.max(0, Math.round(newLoan * 100) / 100)
                );
              }}
              max={0.85}
            />
            {proposedLtv > 0.85 && (
              <p className="text-xs mt-1 italic" style={{ color: "#A0444C" }}>
                Above the 85% cap. Please lower the loan amount.
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 text-xs">
          {!userEditedLoan ? (
            <span className="font-medium" style={{ color: C.forest }}>
              ✿ Auto-suggested at {(suggestedLtvTier * 100).toFixed(0)}% LTV
            </span>
          ) : (
            <button
              onClick={onResetLoan}
              className="underline hover:opacity-80 transition"
              style={{ color: C.forest }}
            >
              Reset to suggested ({fmt(suggestedLoan)})
            </button>
          )}
        </div>
      </Card>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!hasProperty || Number(proposedLoan) <= 0}
          className="w-full sm:w-auto px-8 py-3 rounded-md text-sm font-medium shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
          style={{ backgroundColor: C.forest, color: "white" }}
        >
          Continue to structure →
        </button>
      </div>
    </div>
  );
}

// =========================================================
// STEP 2: SELECT
// =========================================================
function SelectStep({ onBack, onSelect }) {
  return (
    <div>
      <div className="mb-10 text-center">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
        >
          Which structure <em style={{ color: C.sage }}>suits you best</em>?
        </h2>
        <p className="text-sm" style={{ color: C.mutedText }}>
          Every business has its own rhythm. Explore one option in detail, or compare both side-by-side.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StructureChoice
          title="Interest-Only"
          subtitle="1-year tenure, reviewable"
          description="Pay only the interest each month. The principal stays untouched until end of term, giving your business breathing room."
          accent="sage"
          icon={<ClockIcon color={C.sageDark} size={28} />}
          onSelect={() => onSelect("ionly")}
        />
        <StructureChoice
          title="P+I Balloon"
          subtitle="Balloon at year 5"
          description="Pay Principal + Interest monthly. Build equity steadily; a smaller balloon at year 5 puts you in a stronger position."
          accent="forest"
          icon={<TreeIcon color={C.forest} size={28} />}
          onSelect={() => onSelect("balloon")}
        />
        <StructureChoice
          title="Compare both"
          subtitle="Side-by-side view"
          description="See both options together. Monthly commitments, end-of-term figures, and the reasoning behind each."
          accent="sand"
          icon={<PercentIcon color={C.sandDark} size={28} />}
          onSelect={() => onSelect("both")}
        />
      </div>

      <div className="flex justify-start pt-8">
        <button
          onClick={onBack}
          className="text-sm transition hover:opacity-70"
          style={{ color: C.mutedText }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function StructureChoice({ title, subtitle, description, accent, icon, onSelect }) {
  const accentMap = {
    sage: { border: C.sage, hoverBorder: C.sageDark, subtitleColor: C.sageDark, bg: C.mint + "30" },
    forest: { border: C.forest, hoverBorder: C.forestDark, subtitleColor: C.forest, bg: C.mint + "50" },
    sand: { border: C.sand, hoverBorder: C.sandDark, subtitleColor: C.sandDark, bg: C.sand + "30" },
  };
  const a = accentMap[accent];
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="text-left bg-white rounded-xl p-5 sm:p-6 transition-all duration-300"
      style={{
        border: `2px solid ${hover ? a.hoverBorder : C.cardBorder}`,
        boxShadow: hover ? `0 8px 24px -8px ${C.forest}30` : `0 1px 2px ${C.forest}10`,
        transform: hover ? "translateY(-2px)" : "none",
      }}
    >
      <div className="mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: a.bg }}>
        {icon}
      </div>
      <div
        className="text-xs uppercase tracking-widest mb-1"
        style={{ color: a.subtitleColor, fontWeight: 500 }}
      >
        {subtitle}
      </div>
      <h3
        className="text-2xl font-light tracking-tight"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed mt-3" style={{ color: C.mutedText }}>
        {description}
      </p>
      <div className="mt-4 text-xs" style={{ color: C.sage }}>Explore →</div>
    </button>
  );
}

// =========================================================
// ANIMATED NUMBER
// =========================================================
function useAnimatedValue(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const to = Number(target) || 0;

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setValue(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// =========================================================
// STEP 3: RESULTS
// =========================================================
function ResultsStep({
  selectedStructure,
  proposedLoan,
  applicableLoan,
  applicableLoanIOnly,
  applicableLoanBalloon,
  cpfPrincipal,
  cpfIOnly,
  cpfBalloon,
  cpfForStructure,
  outstanding,
  processingFee,
  processingFeeIOnly,
  processingFeeBalloon,
  fireInsurance,
  legalFee,
  valuationFee,
  cashout,
  cashoutIOnly,
  cashoutBalloon,
  interestRate,
  iOnlyMonthly,
  iOnlyEndOfTerm,
  balloonMonthly,
  balloonEndBalance,
  amortYears,
  setAmortYears,
  iOnlySchedule,
  balloonSchedule,
  balloonMonths,
  showSchedule,
  setShowSchedule,
  compareFeesOpen,
  setCompareFeesOpen,
  fmt,
  fmtPct,
  onBack,
  onRestart,
  onProceed,
}) {
  const isCompare = selectedStructure === "both";
  const showIOnly = selectedStructure === "ionly";
  const showBalloon = selectedStructure === "balloon";
  const hasCpf = cpfPrincipal > 0;

  const animCashout = useAnimatedValue(cashout, 1200);

  const title = isCompare
    ? "Compare both"
    : showIOnly
    ? "Interest-Only · A year to breathe"
    : "P+I Balloon · Steady progress";

  // CPF projection period label for the deduction block
  const cpfPeriodLabel = isCompare
    ? "· conservative (12-month)"
    : showIOnly
    ? "· 12-month projection"
    : "· 3-month projection";

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-baseline justify-between flex-wrap gap-3">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
        >
          {title}
        </h2>
        <div className="flex gap-3 text-xs">
          <button onClick={onBack} className="transition hover:opacity-70" style={{ color: C.mutedText }}>
            ← Change structure
          </button>
          <span style={{ color: C.cardBorder }}>|</span>
          <button onClick={onRestart} className="transition hover:opacity-70" style={{ color: C.mutedText }}>
            Start over
          </button>
        </div>
      </div>

      {/* CPF DEDUCTION BLOCK — only shows when CPF > 0 */}
      {hasCpf && (
        <div
          className="rounded-xl p-4 sm:p-5"
          style={{
            backgroundColor: C.sand + "33",
            border: `1px solid ${C.sand}99`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sprout color={C.sandDark} size={18} />
            <h3 className="text-xs uppercase tracking-widest font-medium" style={{ color: C.sandDark }}>
              CPF projection · applicable loan calculation
            </h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span style={{ color: C.bodyText }}>Proposed loan</span>
              <span className="tabular-nums" style={{ color: C.bodyText }}>{fmt(proposedLoan)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: C.bodyText }}>
                Less: CPF projection{" "}
                <span className="italic text-xs" style={{ color: C.sandDark }}>
                  {cpfPeriodLabel}
                </span>
              </span>
              <span className="tabular-nums" style={{ color: C.bodyText }}>
                −{fmt(cpfForStructure)}
              </span>
            </div>
            <div
              className="flex justify-between font-semibold pt-2 mt-1"
              style={{ borderTop: `1px solid ${C.sand}`, color: C.forestDark }}
            >
              <span>Estimated Applicable Loan Amount</span>
              <span className="tabular-nums">{fmt(applicableLoan)}</span>
            </div>
          </div>
          <p className="text-xs mt-3 italic leading-relaxed" style={{ color: C.sandDark }}>
            CPF utilisation is projected over your repayment period and reduces the disbursable loan amount.
          </p>
        </div>
      )}

      {/* COMPARE VIEW or SINGLE VIEW */}
      {isCompare ? (
        <CompareView
          applicableLoanIOnly={applicableLoanIOnly}
          applicableLoanBalloon={applicableLoanBalloon}
          cashoutIOnly={cashoutIOnly}
          cashoutBalloon={cashoutBalloon}
          iOnlyMonthly={iOnlyMonthly}
          balloonMonthly={balloonMonthly}
          processingFeeIOnly={processingFeeIOnly}
          processingFeeBalloon={processingFeeBalloon}
          fireInsurance={fireInsurance}
          interestRate={interestRate}
          fmt={fmt}
          fmtPct={fmtPct}
          compareFeesOpen={compareFeesOpen}
          setCompareFeesOpen={setCompareFeesOpen}
        />
      ) : (
        <>
          {/* HERO CASH-OUT */}
          <div
            className="relative rounded-2xl p-6 sm:p-8 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestDark} 50%, ${C.forestDarker} 100%)`,
              boxShadow: `0 20px 40px -20px ${C.forestDark}80`,
              color: "white",
            }}
          >
            <div
              className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-30"
              style={{ background: C.mint }}
            />
            <div
              className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-20"
              style={{ background: C.sand }}
            />
            <svg
              className="absolute top-4 right-4 opacity-20"
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
            >
              <path
                d="M100 20 C100 20 40 30 40 70 C40 85 55 95 70 95 C95 95 105 75 100 20 Z"
                stroke={C.mint}
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M70 95 L50 65 M60 80 L75 70 M55 72 L68 62"
                stroke={C.mint}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="relative">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs uppercase tracking-widest" style={{ color: C.mint }}>
                  Your cash-out at disbursement
                </span>
                <span className="text-xs" style={{ color: C.mint + "CC" }}>
                  indicative
                </span>
              </div>

              <div
                className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight mb-6 tabular-nums leading-none"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {fmt(animCashout)}
              </div>

              <div
                className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-2 text-sm pt-4"
                style={{ borderTop: `1px solid ${C.mint}30` }}
              >
                <div style={{ color: C.mint }}>Estimated Applicable Loan</div>
                <div className="text-right tabular-nums">{fmt(applicableLoan)}</div>
                <div style={{ color: C.mint }}>Less: current outstanding</div>
                <div className="text-right tabular-nums">−{fmt(outstanding)}</div>
                <div style={{ color: C.mint }}>Less: processing fee</div>
                <div className="text-right tabular-nums">−{fmt(processingFee)}</div>
                <div style={{ color: C.mint }}>Less: fire insurance</div>
                <div className="text-right tabular-nums">−{fmt(fireInsurance)}</div>
              </div>
            </div>
          </div>

          {/* Single-structure card */}
          <div className="grid gap-5 grid-cols-1">
            {showIOnly && (
              <StructureCard
                title="Interest-Only"
                subtitle="1-year tenure, reviewable"
                accent="sage"
                icon={<ClockIcon color={C.sageDark} size={22} />}
                monthly={iOnlyMonthly}
                endOfTerm={iOnlyEndOfTerm}
                endOfTermLabel="Principal due at end of year 1"
                description="Interest-only monthly payments keep your outgoings light. The full principal is due when the term ends."
                onShowSchedule={() => setShowSchedule(showSchedule === "ionly" ? null : "ionly")}
                scheduleOpen={showSchedule === "ionly"}
                fmt={fmt}
                rationale={
                  <>
                    <p className="mb-2" style={{ color: C.forestDark, fontWeight: 500 }}>
                      Why pick Interest-Only
                    </p>
                    <p style={{ color: C.bodyText }}>
                      Best if you expect a liquidity event within the next year, perhaps a contract,
                      asset sale, or refinancing window. Light monthly outgoings protect your working
                      capital while you wait.
                    </p>
                  </>
                }
              />
            )}
            {showBalloon && (
              <StructureCard
                title="P+I Balloon"
                subtitle={`${amortYears}-year amortisation, balloon at year 5`}
                accent="forest"
                icon={<TreeIcon color={C.forest} size={22} />}
                monthly={balloonMonthly}
                endOfTerm={balloonEndBalance}
                endOfTermLabel="Balloon due at end of year 5"
                description={`Principal + Interest monthly on a ${amortYears}-year schedule. Each payment reduces principal. The remaining balance is due as a balloon at year 5.`}
                onShowSchedule={() => setShowSchedule(showSchedule === "balloon" ? null : "balloon")}
                scheduleOpen={showSchedule === "balloon"}
                fmt={fmt}
                extraInput={
                  <div className="pt-3" style={{ borderTop: `1px dashed ${C.cardBorder}` }}>
                    <label className="block">
                      <div className="text-xs mb-1" style={{ color: C.mutedText }}>
                        Amortisation tenure (years)
                      </div>
                      <input
                        type="number"
                        value={amortYears ?? ""}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v > 0 && v <= 30) setAmortYears(v);
                        }}
                        min={1}
                        max={30}
                        className="w-full py-1.5 px-2 rounded-md text-sm outline-none bg-white"
                        style={{ border: `1px solid ${C.cardBorder}` }}
                      />
                    </label>
                    <p className="text-xs mt-1 italic" style={{ color: C.mutedText }}>
                      Up to 30 years. Balloon is fixed at year 5.
                    </p>
                  </div>
                }
                rationale={
                  <>
                    <p className="mb-2" style={{ color: C.forestDark, fontWeight: 500 }}>
                      Why pick P+I Balloon
                    </p>
                    <p style={{ color: C.bodyText }}>
                      Best if you'd rather chip away at the debt steadily. Each payment builds equity,
                      leaving a smaller balloon at year 5 and a stronger refinancing position.
                    </p>
                  </>
                }
              />
            )}
          </div>

          {showSchedule === "ionly" && (
            <ScheduleTable
              title="Interest-Only · 12-month payment schedule"
              rows={iOnlySchedule}
              fmt={fmt}
              onClose={() => setShowSchedule(null)}
            />
          )}
          {showSchedule === "balloon" && (
            <ScheduleTable
              title={`P+I Balloon · ${balloonMonths}-month amortisation schedule`}
              rows={balloonSchedule}
              fmt={fmt}
              onClose={() => setShowSchedule(null)}
            />
          )}
        </>
      )}

      {/* UPFRONT COSTS */}
      <div
        className="rounded-xl p-4 sm:p-5"
        style={{
          backgroundColor: C.sand + "30",
          border: `1px solid ${C.sand}80`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <DocumentIcon color={C.sandDark} size={18} />
          <h3 className="text-xs uppercase tracking-widest font-medium" style={{ color: C.sandDark }}>
            Upfront costs · paid directly by you
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          <div style={{ color: C.bodyText }}>Legal fee</div>
          <div className="text-right tabular-nums font-medium">{fmt(legalFee)}</div>
          <div style={{ color: C.bodyText }}>Valuation fee</div>
          <div className="text-right tabular-nums font-medium">{fmt(valuationFee)}</div>
          <div className="font-semibold pt-2" style={{ color: C.forestDark, borderTop: `1px solid ${C.sand}` }}>
            Total upfront
          </div>
          <div className="text-right tabular-nums font-semibold pt-2" style={{ borderTop: `1px solid ${C.sand}` }}>
            {fmt(Number(legalFee) + Number(valuationFee))}
          </div>
        </div>
        <p className="text-xs mt-3 italic leading-relaxed" style={{ color: C.sandDark }}>
          The amounts above are indicative, based on a single-name property owner and valuation quoted for
          a condominium unit. Please consult Vu for a more accurate quotation. Payments are to be made directly
          to the appointed lawyer and valuer before the loan completion date.
        </p>
      </div>

      {/* EXIT STRATEGY */}
      <div
        className="rounded-xl p-5 sm:p-6 bg-white"
        style={{ border: `1px solid ${C.cardBorder}` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <LeafIcon color={C.forest} size={18} />
          <h3 className="text-xs uppercase tracking-widest font-medium" style={{ color: C.forest }}>
            When the term ends · your options
          </h3>
        </div>
        <p className="text-sm mb-4" style={{ color: C.mutedText }}>
          At maturity, you're in the driver's seat. Two paths forward:
        </p>
        <div className="space-y-3">
          <ExitOption
            num="1"
            title="Refinance to another FI or local bank"
            desc="As your business grows stronger, take the opportunity to refinance, whether to another financial institution or back to a local bank."
          />
          <ExitOption
            num="2"
            title="Renew with us"
            desc="If the partnership has served you well, we're happy to continue the facility."
          />
        </div>
      </div>

      {/* CTA — view snapshot */}
      <div
        className="rounded-xl p-5 sm:p-6 flex items-center justify-between flex-wrap gap-4"
        style={{
          background: `linear-gradient(135deg, ${C.forestDark} 0%, ${C.forest} 100%)`,
          color: "white",
        }}
      >
        <div className="flex items-center gap-4">
          <CheckCircleIcon color={C.mint} size={28} />
          <div>
            <h3 className="text-lg font-medium mb-0.5">Ready for your snapshot?</h3>
            <p className="text-sm" style={{ color: C.mint }}>
              Review the one-screen summary you can share or screenshot.
            </p>
          </div>
        </div>
        <button
          onClick={onProceed}
          className="w-full sm:w-auto px-6 py-3 rounded-md text-sm font-medium transition hover:opacity-90"
          style={{ backgroundColor: "white", color: C.forestDark }}
        >
          View Loan Snapshot →
        </button>
      </div>
    </div>
  );
}

// =========================================================
// COMPARE VIEW — two-column metrics table with collapsible fees
// =========================================================
function CompareView({
  applicableLoanIOnly,
  applicableLoanBalloon,
  cashoutIOnly,
  cashoutBalloon,
  iOnlyMonthly,
  balloonMonthly,
  processingFeeIOnly,
  processingFeeBalloon,
  fireInsurance,
  interestRate,
  fmt,
  fmtPct,
  compareFeesOpen,
  setCompareFeesOpen,
}) {
  return (
    <div className="space-y-5">
      {/* TWO-COLUMN METRICS TABLE */}
      <div
        className="rounded-2xl overflow-hidden bg-white"
        style={{ border: `1px solid ${C.cardBorder}` }}
      >
        {/* Headers */}
        <div className="grid grid-cols-2">
          <div
            className="p-4 sm:p-5 text-center"
            style={{
              borderBottom: `2px solid ${C.sage}`,
              borderRight: `1px solid ${C.cardBorder}99`,
              background: `linear-gradient(180deg, ${C.mint}40 0%, ${C.mint}10 100%)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
            >
              <ClockIcon color={C.sageDark} size={20} />
            </div>
            <div
              className="text-xs uppercase tracking-wider font-medium mb-0.5"
              style={{ color: C.sageDark }}
            >
              Option A
            </div>
            <h3
              className="text-lg sm:text-xl font-normal mb-0.5"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
            >
              Interest-Only
            </h3>
            <div className="text-xs" style={{ color: C.mutedText }}>
              1-year tenure, reviewable
            </div>
          </div>

          <div
            className="p-4 sm:p-5 text-center"
            style={{
              borderBottom: `2px solid ${C.forest}`,
              background: `linear-gradient(180deg, ${C.mint}40 0%, ${C.mint}10 100%)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
            >
              <TreeIcon color={C.forest} size={20} />
            </div>
            <div
              className="text-xs uppercase tracking-wider font-medium mb-0.5"
              style={{ color: C.forest }}
            >
              Option B
            </div>
            <h3
              className="text-lg sm:text-xl font-normal mb-0.5"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
            >
              P+I Balloon
            </h3>
            <div className="text-xs" style={{ color: C.mutedText }}>
              Balloon at year 5
            </div>
          </div>
        </div>

        {/* Rows */}
        <CompareRowLabel label="Cash-out at disbursement" />
        <div className="grid grid-cols-2">
          <CompareCell value={fmt(cashoutIOnly)} variant="cashout" leftBorder />
          <CompareCell value={fmt(cashoutBalloon)} variant="cashout" />
        </div>

        <CompareRowLabel label="Monthly servicing" />
        <div className="grid grid-cols-2">
          <CompareCell value={fmt(iOnlyMonthly)} sub="interest only" leftBorder />
          <CompareCell value={fmt(balloonMonthly)} sub="P + I" />
        </div>

        <CompareRowLabel label="Interest rate" />
        <div className="grid grid-cols-2">
          <CompareCell value={fmtPct(interestRate)} sub="p.a." small leftBorder />
          <CompareCell value={fmtPct(interestRate)} sub="p.a." small />
        </div>

        <CompareRowLabel label="Tenure" />
        <div className="grid grid-cols-2">
          <CompareCell value="1 year" sub="reviewable" small leftBorder noBottomBorder />
          <CompareCell value="5 years" sub="balloon" small noBottomBorder />
        </div>

        {/* Fees toggle */}
        <button
          onClick={() => setCompareFeesOpen(!compareFeesOpen)}
          className="w-full py-2.5 px-4 text-xs transition hover:bg-stone-50"
          style={{
            borderTop: `1px solid ${C.cardBorder}99`,
            color: C.mutedText,
            backgroundColor: C.lightBg + "80",
          }}
        >
          {compareFeesOpen ? "Hide fees & charges ▴" : "Show fees & charges ▾"}
        </button>

        {/* Fees detail */}
        {compareFeesOpen && (
          <div
            className="px-4 py-3"
            style={{
              borderTop: `1px solid ${C.cardBorder}99`,
              backgroundColor: C.lightBg + "60",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider text-center mb-1"
              style={{ color: C.mutedText }}
            >
              Processing fee
            </div>
            <div className="grid grid-cols-2 mb-3">
              <div
                className="text-center text-xs tabular-nums font-medium"
                style={{ color: C.bodyText, borderRight: `1px solid ${C.cardBorder}80` }}
              >
                {fmt(processingFeeIOnly)}
              </div>
              <div className="text-center text-xs tabular-nums font-medium" style={{ color: C.bodyText }}>
                {fmt(processingFeeBalloon)}
              </div>
            </div>
            <div
              className="text-[10px] uppercase tracking-wider text-center mb-1"
              style={{ color: C.mutedText }}
            >
              Fire insurance
            </div>
            <div className="grid grid-cols-2">
              <div
                className="text-center text-xs tabular-nums font-medium"
                style={{ color: C.bodyText, borderRight: `1px solid ${C.cardBorder}80` }}
              >
                {fmt(fireInsurance)}
              </div>
              <div className="text-center text-xs tabular-nums font-medium" style={{ color: C.bodyText }}>
                {fmt(fireInsurance)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RATIONALE CARDS — equal weight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 sm:p-5 bg-white"
          style={{ border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.sage}` }}
        >
          <div
            className="text-xs uppercase tracking-wider font-medium mb-1"
            style={{ color: C.sageDark }}
          >
            Why pick Interest-Only
          </div>
          <h4
            className="text-base font-normal mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            A year to breathe
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: C.bodyText }}>
            Best if you expect a liquidity event within the next year, perhaps a contract, asset sale,
            or refinancing window. Light monthly outgoings protect your working capital while you wait.
          </p>
        </div>

        <div
          className="rounded-xl p-4 sm:p-5 bg-white"
          style={{ border: `1px solid ${C.cardBorder}`, borderTop: `3px solid ${C.forest}` }}
        >
          <div
            className="text-xs uppercase tracking-wider font-medium mb-1"
            style={{ color: C.forest }}
          >
            Why pick P+I Balloon
          </div>
          <h4
            className="text-base font-normal mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            Steady progress
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: C.bodyText }}>
            Best if you'd rather chip away at the debt steadily. Each payment builds equity, leaving a
            smaller balloon at year 5 and a stronger refinancing position.
          </p>
        </div>
      </div>
    </div>
  );
}

function CompareRowLabel({ label }) {
  return (
    <div
      className="px-4 pt-2.5 pb-1 text-center text-[10px] uppercase tracking-wider"
      style={{
        color: C.mutedText,
        backgroundColor: C.lightBg + "80",
      }}
    >
      {label}
    </div>
  );
}

function CompareCell({ value, sub, variant, small, leftBorder, noBottomBorder }) {
  const numStyle = {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: small ? "16px" : "22px",
    color: variant === "cashout" ? C.forest : C.forestDark,
    fontWeight: variant === "cashout" ? 500 : 400,
    lineHeight: 1.1,
  };
  return (
    <div
      className="px-3 sm:px-4 pt-1.5 pb-3 text-center"
      style={{
        borderRight: leftBorder ? `1px solid ${C.cardBorder}80` : "none",
        borderBottom: noBottomBorder ? "none" : `1px solid ${C.cardBorder}80`,
      }}
    >
      <div className="tabular-nums" style={numStyle}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] mt-0.5" style={{ color: C.mutedText }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// =========================================================
// STEP 4: NEXT STEPS
// =========================================================
// =========================================================
// STEP 4: SNAPSHOT (single-screen quotation card)
// =========================================================
function SnapshotStep({
  selectedStructure,
  applicableLoanIOnly,
  applicableLoanBalloon,
  cashoutIOnly,
  cashoutBalloon,
  iOnlyMonthly,
  balloonMonthly,
  processingFeeIOnly,
  processingFeeBalloon,
  fireInsurance,
  legalFee,
  valuationFee,
  interestRate,
  fmt,
  onBack,
  onProceed,
}) {
  // For "Compare both", default to Interest-Only view in the snapshot
  const isBalloon = selectedStructure === "balloon";
  const aLoan = isBalloon ? applicableLoanBalloon : applicableLoanIOnly;
  const cashout = isBalloon ? cashoutBalloon : cashoutIOnly;
  const monthly = isBalloon ? balloonMonthly : iOnlyMonthly;
  const procFee = isBalloon ? processingFeeBalloon : processingFeeIOnly;
  const structureLabel = isBalloon
    ? "P+I Balloon · Year 5"
    : selectedStructure === "both"
    ? "Interest-Only · 1-year tenure"
    : "Interest-Only · 1-year tenure";
  const tenureLabel = isBalloon ? "5 years (balloon)" : "1 year (reviewable)";

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-2"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
        >
          Your <em style={{ color: C.sage }}>quote at a glance</em>
        </h2>
        <p className="text-sm" style={{ color: C.mutedText }}>
          Screenshot or share. This is the snapshot to walk away with.
        </p>
      </div>

      {/* THE SNAPSHOT CARD — designed to fit one mobile screen */}
      <div
        className="rounded-2xl bg-white p-5 sm:p-6 mx-auto"
        style={{ border: `1px solid ${C.cardBorder}`, maxWidth: "420px" }}
      >
        {/* Header */}
        <div
          className="text-center pb-3 mb-4"
          style={{ borderBottom: `1px dashed ${C.cardBorder}` }}
        >
          <div
            className="text-[10px] uppercase tracking-widest mb-1"
            style={{ color: C.sage }}
          >
            VuCalc+ · Indicative quotation
          </div>
          <h3
            className="text-base sm:text-lg font-normal"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            {structureLabel}
          </h3>
        </div>

        {/* Hero numbers */}
        <div className="space-y-2.5 mb-4">
          <SnapshotHeroItem
            label="Estimated Applicable Loan"
            value={fmt(aLoan)}
            primary
          />
          <SnapshotHeroItem label="Cash-out at disbursement" value={fmt(cashout)} />
          <SnapshotHeroItem label="Monthly payment" value={fmt(monthly)} />
        </div>

        {/* Terms */}
        <div
          className="text-[10px] uppercase tracking-widest mb-1.5"
          style={{ color: C.sage }}
        >
          Terms
        </div>
        <div className="text-xs space-y-1 mb-4">
          <SnapshotMiniRow label="Interest rate" value={`${(interestRate * 100).toFixed(2)}% p.a.`} />
          <SnapshotMiniRow label="Tenure" value={tenureLabel} />
          <SnapshotMiniRow label="Processing fee" value={fmt(procFee)} />
          <SnapshotMiniRow label="Fire insurance" value={fmt(fireInsurance)} last />
        </div>

        {/* Third-party fees */}
        <div
          className="text-[10px] uppercase tracking-widest mb-1.5"
          style={{ color: C.sage }}
        >
          Third-party fees
        </div>
        <div className="text-xs space-y-1">
          <SnapshotMiniRow label="Valuation fee" value={fmt(valuationFee)} />
          <SnapshotMiniRow label="Legal fee" value={fmt(legalFee)} last />
        </div>
        <p
          className="text-xs italic leading-relaxed mt-3 pt-3"
          style={{ color: C.mutedText, borderTop: `1px dashed ${C.cardBorder}` }}
        >
          Indicative third-party fees such as valuation and legal are payable by the client before
          loan disbursement.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="mx-auto" style={{ maxWidth: "420px" }}>
        <button
          onClick={onProceed}
          className="w-full px-6 py-3 rounded-md text-sm font-medium transition hover:opacity-90"
          style={{ backgroundColor: C.forest, color: "white" }}
        >
          Request a confirmed quote →
        </button>
        <div className="text-center mt-2">
          <button
            onClick={onBack}
            className="text-xs transition hover:opacity-70"
            style={{ color: C.mutedText }}
          >
            ← Back to proposal
          </button>
        </div>
      </div>
    </div>
  );
}

function SnapshotHeroItem({ label, value, primary }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: primary ? C.forestDark : C.lightBg,
        color: primary ? "white" : C.forestDark,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider mb-0.5"
        style={{ color: primary ? C.mint : C.mutedText }}
      >
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "20px",
          fontWeight: 400,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SnapshotMiniRow({ label, value, last }) {
  return (
    <div
      className="flex justify-between py-1"
      style={{ borderBottom: last ? "none" : `1px dashed ${C.cardBorder}80` }}
    >
      <span style={{ color: C.mutedText }}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color: C.forestDark }}>
        {value}
      </span>
    </div>
  );
}

// =========================================================
// STEP 5: NEXT STEPS (with WhatsApp share)
// =========================================================
function NextStepsStep({
  phone,
  selectedStructure,
  applicableLoanIOnly,
  applicableLoanBalloon,
  cashoutIOnly,
  cashoutBalloon,
  iOnlyMonthly,
  balloonMonthly,
  fmt,
  onBack,
}) {
  // Build the WhatsApp message based on role + selected structure.
  // Phone number is never displayed in UI; only used in the wa.me URL on click.
  const buildWhatsappMessage = (role) => {
    const isBalloon = selectedStructure === "balloon";
    const aLoan = isBalloon ? applicableLoanBalloon : applicableLoanIOnly;
    const cashout = isBalloon ? cashoutBalloon : cashoutIOnly;
    const monthly = isBalloon ? balloonMonthly : iOnlyMonthly;
    const structLabel = isBalloon ? "P+I Balloon, Year 5" : "Interest-Only, 1-year";

    if (role === "broker") {
      return [
        "Hi Vu, requesting a quotation for a client.",
        "",
        "ABOUT THE PROPERTY",
        "- Address: [please fill]",
        "- Type: [Condo / Landed / Commercial / Industrial B1]",
        "- Size: [sqft]",
        "- Tenure: [Freehold / 99-year / 999-year]",
        "- Indicative valuation: $[amount]",
        "",
        "ABOUT THE BORROWER",
        "- Borrower: [Pte Ltd / individual]",
        "- Existing loan: $[amount] with [bank]",
        "- CPF used: $[amount, or 'none']",
        "",
        "INDICATIVE FROM VUCALC+",
        `- Estimated loan: ${fmt(aLoan)}`,
        `- Cashout: ${fmt(cashout)}`,
        `- Monthly: ${fmt(monthly)} (${structLabel})`,
        "",
        "Could you share a confirmed quote? Thanks.",
      ].join("\n");
    }
    if (role === "client") {
      return [
        "Hi Vu, I'd like to explore a property loan and got these indicative numbers from VuCalc+.",
        "",
        "ABOUT THE PROPERTY",
        "- Address: [please fill]",
        "- Type: [Condo / Landed / Commercial / Industrial B1]",
        "- Size: [sqft]",
        "- Tenure: [Freehold / 99-year / 999-year]",
        "- Estimated value: $[amount]",
        "",
        "ABOUT MY SITUATION",
        "- Borrower: [my company / personal]",
        "- Existing loan: $[amount] with [bank]",
        "- CPF used: $[amount, or 'none']",
        "",
        "INDICATIVE FROM VUCALC+",
        `- Estimated loan: ${fmt(aLoan)}`,
        `- Cashout: ${fmt(cashout)}`,
        `- Monthly: ${fmt(monthly)} (${structLabel})`,
        "",
        "Could you walk me through next steps?",
      ].join("\n");
    }
    return "Hi Vu, I'd like to chat about a property loan.";
  };

  const openWhatsapp = (role) => {
    const msg = encodeURIComponent(buildWhatsappMessage(role));
    const url = `https://wa.me/${phone}?text=${msg}`;
    window.open(url, "_blank");
  };

  const docs = [
    "Details of the property, including address, size, and tenure",
    "Names of the borrower and personal guarantor(s), so we can run ACRA and EIS searches",
    "Copy of NRIC for each guarantor",
    "Latest 2 years' financial reports or management accounts (FY2024 and FY2025)",
    "Latest 3 months' company bank statements (Jan to Mar 2026)",
  ];

  const docsWithLinks = [
    {
      text: "Copy of the latest 2 years' Notice of Assessment for each guarantor (YA2024 and YA2025)",
      linkText: "Retrieve from IRAS myTax Portal",
      href: "https://mytax.iras.gov.sg/ESVWeb/default.aspx",
    },
    {
      text: "Latest CBS Report for each guarantor (pulled within this month)",
      linkText: "Purchase from Credit Bureau Singapore",
      href: "https://www.creditbureau.com.sg/buy-my-credit-report.html",
    },
    {
      text: "Latest loan statement(s) for the property to be financed (March 2026 statement) or Letter of Offer(s)",
    },
    {
      text: "Latest CPF statement for the property to be financed",
      linkText: "How to retrieve your CPF statement",
      href: "https://www.cpf.gov.sg/service/article/how-do-i-view-my-cpf-yearly-statement-of-account",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            A few things to <em style={{ color: C.sage }}>prepare</em>
          </h2>
        </div>
        <button
          onClick={onBack}
          className="text-xs transition hover:opacity-70"
          style={{ color: C.mutedText }}
        >
          ← Back to snapshot
        </button>
      </div>

      {/* Simple contact line — phone number kept hidden */}
      <div
        className="rounded-lg px-4 py-3 text-sm flex flex-wrap items-center gap-2"
        style={{
          backgroundColor: C.mint + "60",
          border: `1px solid ${C.sage}66`,
          color: C.forestDark,
        }}
      >
        <span className="font-medium">Speak to Vu directly</span>
        <span style={{ color: C.mutedText }}>·</span>
        <a
          href="mailto:thienvu_le@ols.com.sg"
          className="font-medium hover:underline"
          style={{ color: C.forestDark }}
        >
          thienvu_le@ols.com.sg
        </a>
        <span style={{ color: C.mutedText }}>·</span>
        <button
          onClick={() => openWhatsapp("plain")}
          className="font-medium hover:underline"
          style={{ color: C.forestDark, background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          WhatsApp
        </button>
      </div>

      {/* TOP WhatsApp share panel */}
      <WhatsappPanel
        eyebrow="Send via WhatsApp"
        title="Pick the message that fits you"
        subtitle="We'll pre-fill your snapshot. You add the property details, then send."
        topSubBroker="Requesting a quotation on behalf of a client."
        topSubClient="Exploring a loan for my own property."
        onWhatsapp={openWhatsapp}
      />

      {/* Document checklist */}
      <div
        className="rounded-xl overflow-hidden bg-white"
        style={{ border: `1px solid ${C.cardBorder}` }}
      >
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{
            borderBottom: `1px solid ${C.cardBorder}`,
            backgroundColor: C.bone + "80",
          }}
        >
          <DocumentIcon color={C.forest} size={18} />
          <h3 className="text-xs uppercase tracking-widest font-medium" style={{ color: C.forest }}>
            Document checklist
          </h3>
        </div>

        <ol>
          {docs.map((d, i) => (
            <DocItem key={i} num={i + 1} text={d} isLast={false} />
          ))}
          {docsWithLinks.map((d, i) => (
            <DocItem
              key={docs.length + i}
              num={docs.length + i + 1}
              text={d.text}
              linkText={d.linkText}
              href={d.href}
              isLast={i === docsWithLinks.length - 1}
            />
          ))}
        </ol>
      </div>

      {/* Site visit */}
      <div
        className="rounded-xl p-4 sm:p-5"
        style={{
          backgroundColor: C.mint + "50",
          border: `1px solid ${C.sage}60`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "white" }}
          >
            <PinIcon color={C.forest} size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: C.forestDark }}>
              A visit to the property
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: C.bodyText }}>
              Once we're aligned on the structure, kindly arrange a time for me and my management to
              visit the pledged property together. It's a short, standard part of the process, and a
              nice chance to meet you in person.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM WhatsApp share panel — for users who scrolled past the top */}
      <WhatsappPanel
        eyebrow="Ready to send?"
        title="One tap to message Vu"
        subtitle="Same templates, in case you scrolled past the top."
        topSubBroker="Send broker template via WhatsApp."
        topSubClient="Send client template via WhatsApp."
        onWhatsapp={openWhatsapp}
      />

      {/* Closing reminder */}
      <div
        className="rounded-lg p-4 text-sm leading-relaxed"
        style={{
          backgroundColor: C.bone + "80",
          border: `1px solid ${C.cardBorder}`,
          color: C.mutedText,
        }}
      >
        All figures in this proposal are indicative. Final terms are subject to credit approval and
        documentation. If anything here needs clarifying, just reach out.
      </div>
    </div>
  );
}

// =========================================================
// WhatsApp share panel (used twice on Step 5)
// =========================================================
function WhatsappPanel({ eyebrow, title, subtitle, topSubBroker, topSubClient, onWhatsapp }) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: `linear-gradient(135deg, ${C.mint}99 0%, ${C.sage}55 100%)`,
        border: `1px solid ${C.sage}80`,
      }}
    >
      <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.forestDark }}>
        {eyebrow}
      </div>
      <h3
        className="text-base sm:text-lg font-normal mt-1 mb-1"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
      >
        {title}
      </h3>
      <p className="text-xs mb-3" style={{ color: C.forestDark }}>
        {subtitle}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <WhatsappRoleButton
          role="I'm a broker"
          sub={topSubBroker}
          onClick={() => onWhatsapp("broker")}
        />
        <WhatsappRoleButton
          role="I'm a client"
          sub={topSubClient}
          onClick={() => onWhatsapp("client")}
        />
      </div>
    </div>
  );
}

function WhatsappRoleButton({ role, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg p-3 transition bg-white hover:shadow-md"
      style={{ border: `1px solid ${C.sage}80` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#25D366" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2 A10 10 0 0 0 4 17 L2 22 L7 20 A10 10 0 1 0 12 2 Z" />
          </svg>
        </div>
        <span className="text-sm font-semibold" style={{ color: C.forestDark }}>
          {role}
        </span>
      </div>
      <div className="text-xs leading-snug" style={{ color: C.mutedText }}>
        {sub}
      </div>
    </button>
  );
}

function DocItem({ num, text, linkText, href, isLast }) {
  return (
    <li
      className="flex gap-4 px-5 py-4"
      style={{
        borderBottom: isLast ? "none" : `1px solid ${C.cardBorder}70`,
      }}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center"
        style={{
          backgroundColor: C.mint + "80",
          color: C.forestDark,
        }}
      >
        {num}
      </div>
      <div className="flex-1">
        <div className="text-sm" style={{ color: C.bodyText }}>
          {text}
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline mt-1 inline-block"
            style={{ color: C.forest }}
          >
            {linkText} ↗
          </a>
        )}
      </div>
    </li>
  );
}

// =========================================================
// STRUCTURE CARD
// =========================================================
function StructureCard({
  title, subtitle, accent, icon, monthly, endOfTerm, endOfTermLabel,
  description, onShowSchedule, scheduleOpen, fmt, extraInput, rationale,
}) {
  const accentMap = {
    sage: { top: C.sage, color: C.sageDark, bg: C.mint + "30" },
    forest: { top: C.forest, color: C.forest, bg: C.mint + "50" },
  };
  const a = accentMap[accent];

  return (
    <div
      className="bg-white rounded-xl p-5 sm:p-6 relative overflow-hidden"
      style={{
        border: `1px solid ${C.cardBorder}`,
        borderTop: `4px solid ${a.top}`,
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: a.bg }}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: a.color }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: C.mutedText }}>{subtitle}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.mutedText }}>
            Monthly payment
          </div>
          <div
            className="text-3xl sm:text-4xl font-light tracking-tight tabular-nums leading-none"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            {fmt(monthly)}
          </div>
        </div>

        <div className="pt-3" style={{ borderTop: `1px dashed ${C.cardBorder}` }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.mutedText }}>
            {endOfTermLabel}
          </div>
          <div
            className="text-2xl font-light tracking-tight tabular-nums"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: C.forestDark }}
          >
            {fmt(endOfTerm)}
          </div>
        </div>

        <p className="text-xs leading-relaxed pt-3" style={{ color: C.mutedText, borderTop: `1px dashed ${C.cardBorder}` }}>
          {description}
        </p>

        {extraInput}

        {rationale && (
          <div
            className="text-xs leading-relaxed rounded-lg p-4"
            style={{ backgroundColor: C.bone + "60", border: `1px solid ${C.cardBorder}` }}
          >
            {rationale}
          </div>
        )}

        <button
          onClick={onShowSchedule}
          className="w-full text-xs py-2 rounded-md transition hover:bg-stone-50"
          style={{ border: `1px solid ${C.cardBorder}`, color: C.mutedText }}
        >
          {scheduleOpen ? "Hide" : "View"} payment schedule
        </button>
      </div>
    </div>
  );
}

function ScheduleTable({ title, rows, fmt, onClose }) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ border: `1px solid ${C.cardBorder}` }}
    >
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 gap-2"
        style={{
          borderBottom: `1px solid ${C.cardBorder}`,
          backgroundColor: C.bone + "80",
        }}
      >
        <h3
          className="text-xs uppercase tracking-widest font-medium leading-tight"
          style={{ color: C.forest }}
        >
          {title}
        </h3>
        <button
          onClick={onClose}
          className="text-xs transition hover:opacity-70 flex-shrink-0"
          style={{ color: C.mutedText }}
        >
          ✕ Close
        </button>
      </div>
      {/* Horizontal scroll on mobile so columns don't get squeezed */}
      <div className="max-h-96 overflow-y-auto overflow-x-auto">
        <table className="w-full text-xs sm:text-sm" style={{ minWidth: "560px" }}>
          <thead
            className="text-[10px] sm:text-xs uppercase tracking-wider sticky top-0"
            style={{ backgroundColor: C.bone, color: C.mutedText }}
          >
            <tr>
              <th className="text-left py-2 px-3 sm:px-4 font-medium">Month</th>
              <th className="text-right py-2 px-3 sm:px-4 font-medium">Beginning</th>
              <th className="text-right py-2 px-3 sm:px-4 font-medium">Interest</th>
              <th className="text-right py-2 px-3 sm:px-4 font-medium">Principal</th>
              <th className="text-right py-2 px-3 sm:px-4 font-medium">Ending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} style={{ borderTop: `1px solid ${C.cardBorder}40` }}>
                <td className="py-1.5 px-3 sm:px-4" style={{ color: C.mutedText }}>
                  {r.month}
                </td>
                <td className="py-1.5 px-3 sm:px-4 text-right tabular-nums">{fmt(r.begin)}</td>
                <td className="py-1.5 px-3 sm:px-4 text-right tabular-nums">{fmt(r.interest)}</td>
                <td className="py-1.5 px-3 sm:px-4 text-right tabular-nums">{fmt(r.principal)}</td>
                <td className="py-1.5 px-3 sm:px-4 text-right tabular-nums">{fmt(r.end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExitOption({ num, title, desc }) {
  return (
    <div
      className="flex gap-4 p-4 rounded-lg"
      style={{
        backgroundColor: C.mint + "40",
        border: `1px solid ${C.sage}40`,
      }}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center"
        style={{ backgroundColor: C.forest, color: "white" }}
      >
        {num}
      </div>
      <div>
        <div className="text-sm font-medium" style={{ color: C.forestDark }}>
          {title}
        </div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.bodyText }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// INPUT COMPONENTS
// =========================================================
function Card({ title, accent, icon, children }) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 bg-white"
      style={{
        border: accent ? `2px solid ${C.forest}` : `1px solid ${C.cardBorder}`,
        boxShadow: accent ? `0 4px 12px ${C.forest}15` : "none",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3
          className="text-xs uppercase tracking-widest font-medium"
          style={{ color: accent ? C.forestDark : C.forest }}
        >
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function formatWithCommas(value) {
  if (value == null || value === "") return "";
  const num = typeof value === "string" ? value : String(value);
  if (num === "") return "";
  const [intPart, decPart] = num.split(".");
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart != null ? `${intWithCommas}.${decPart}` : intWithCommas;
}

function parseNumberInput(str) {
  if (str == null || str === "") return "";
  const cleaned = str.replace(/,/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return cleaned;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? "" : cleaned;
}

function MoneyInput({ label, value, onChange, emphasis, optional }) {
  const [rawInput, setRawInput] = useState(
    value == null || value === "" ? "" : String(value)
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setRawInput(value == null || value === "" ? "" : String(value));
    }
  }, [value, focused]);

  const displayValue = focused
    ? rawInput
    : rawInput === ""
    ? ""
    : formatWithCommas(rawInput);

  return (
    <label className="block">
      <div className="text-xs mb-1" style={{ color: C.mutedText }}>
        {label}
        {optional && (
          <span style={{ color: C.sage, fontStyle: "italic" }}> · optional</span>
        )}
      </div>
      <div
        className="flex items-center rounded-md transition bg-white"
        style={{
          border: emphasis ? `2px solid ${C.forest}` : `1px solid ${C.cardBorder}`,
          boxShadow: emphasis ? `0 0 0 3px ${C.forest}20` : "none",
        }}
      >
        <span className="px-2.5 text-sm" style={{ color: C.mutedText }}>
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const parsed = parseFloat(rawInput.replace(/,/g, ""));
            if (isNaN(parsed)) {
              onChange(null);
              setRawInput("");
            } else {
              onChange(parsed);
              setRawInput(String(parsed));
            }
          }}
          onChange={(e) => {
            const cleaned = parseNumberInput(e.target.value);
            setRawInput(cleaned);
            if (cleaned === "" || cleaned === "-" || cleaned === ".") {
              onChange(null);
            } else {
              const parsed = parseFloat(cleaned);
              if (!isNaN(parsed)) onChange(parsed);
            }
          }}
          placeholder="0.00"
          className={`flex-1 py-2 px-1 bg-transparent text-sm outline-none tabular-nums ${
            emphasis ? "font-semibold text-base" : ""
          }`}
          style={{
            color: emphasis ? C.forestDark : C.bodyText,
          }}
        />
      </div>
    </label>
  );
}

function PercentInput({ label, value, onChange, min, max }) {
  // Hold a raw string buffer while focused so users can type freely
  // (intermediate values like "6.", "6.7" without forcing .toFixed on every keystroke).
  const pctFromValue =
    value == null || isNaN(value) ? "" : (Number(value) * 100).toFixed(2);

  const [rawInput, setRawInput] = useState(pctFromValue);
  const [focused, setFocused] = useState(false);

  // Sync raw input when value changes externally (e.g. Proposed LTV updated because
  // the loan amount was edited, or a reset button was pressed). Only sync when not
  // focused, so we don't disrupt active typing.
  useEffect(() => {
    if (!focused) setRawInput(pctFromValue);
  }, [pctFromValue, focused]);

  const displayValue = focused ? rawInput : pctFromValue;

  const commit = (str) => {
    if (str === "" || str === "." || str === "-") {
      onChange(null);
      return;
    }
    let parsed = parseFloat(str) / 100;
    if (isNaN(parsed)) {
      onChange(null);
      return;
    }
    if (min != null && parsed < min) parsed = min;
    if (max != null && parsed > max) parsed = max;
    onChange(parsed);
  };

  return (
    <label className="block">
      <div className="text-xs mb-1" style={{ color: C.mutedText }}>
        {label}
      </div>
      <div
        className="flex items-center rounded-md bg-white"
        style={{ border: `1px solid ${C.cardBorder}` }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={() => {
            setFocused(true);
            setRawInput(pctFromValue);
          }}
          onBlur={() => {
            setFocused(false);
            commit(rawInput);
          }}
          onChange={(e) => {
            let v = e.target.value;
            // Allow only digits and one decimal point; cap to 2 decimal places.
            // Strip commas if pasted.
            v = v.replace(/,/g, "");
            // Allow empty, single dot, or a number with optional decimal up to 2 places.
            if (!/^\d*\.?\d{0,2}$/.test(v)) return;
            setRawInput(v);

            // Live-update the underlying value only if it's a valid parseable number
            // (so the linked field — e.g. loan amount ↔ LTV — stays in sync while typing).
            if (v !== "" && v !== ".") {
              const parsed = parseFloat(v) / 100;
              if (!isNaN(parsed)) {
                // Apply max cap live, but not min (so a user typing "6" toward "6.75" isn't blocked)
                let finalVal = parsed;
                if (max != null && finalVal > max) finalVal = max;
                onChange(finalVal);
              }
            }
          }}
          placeholder="0.00"
          className="flex-1 py-2 px-2.5 bg-transparent text-sm outline-none tabular-nums"
          style={{ color: C.bodyText }}
        />
        <span className="px-2.5 text-sm" style={{ color: C.mutedText }}>
          %
        </span>
      </div>
    </label>
  );
}
