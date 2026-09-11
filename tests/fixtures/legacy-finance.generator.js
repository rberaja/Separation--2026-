var _dr=0.065; function getDR(){return _dr;}
function nv(v) { return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? 0 : Number(v); }
function amortPmt(balance, annualRate, amortPeriod) {
  if (balance <= 0 || amortPeriod <= 0) return 0;
  if (annualRate === 0) return balance / (amortPeriod * 12);
  var r = annualRate / 12;
  var N = amortPeriod * 12;
  return balance * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
}

/*
 * Outstanding balance remaining on an amortizing loan given a known monthly payment,
 * after 'yearsPaid' years of P+I payments.
 */
function remainingBalance(balance, annualRate, amortPeriod, yearsPaid) {
  if (balance <= 0 || amortPeriod <= 0) return balance;
  if (annualRate === 0) return balance - (balance / (amortPeriod * 12)) * yearsPaid * 12;
  var r   = annualRate / 12;
  var N   = amortPeriod * 12;
  var n   = yearsPaid * 12;
  var pmt = balance * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
  return balance * Math.pow(1 + r, n) - pmt * (Math.pow(1 + r, n) - 1) / r;
}

function remainingBalanceFromPmt(balance, annualRate, monthlyPayment, yearsPaid) {
  if (balance <= 0 || yearsPaid <= 0) return balance;
  if (annualRate === 0) return balance - monthlyPayment * yearsPaid * 12;
  var r = annualRate / 12;
  var n = Math.round(yearsPaid * 12);
  return balance * Math.pow(1 + r, n) - monthlyPayment * (Math.pow(1 + r, n) - 1) / r;
}

/*
 * Annual Debt Service (what the owner pays the lender this year).
 *
 *   ioYears  > 0  →  currently in IO period → interest only
 *   ioYears == 0  →  in P&I period → full amortizing payment on 30-yr schedule
 */
function calcADS(prop) {
  var bal      = nv(prop.loanBal);
  var rate     = nv(prop.loanRate) / 100;
  var ioYears  = nv(prop.ioYears);
  var amortPer = nv(prop.amortPeriod) || 30;
  var mthlyPmt = nv(prop.monthlyPmt);
  if (bal <= 0) return 0;
  if (ioYears > 0) return bal * rate;                           // IO phase: interest only
  if (mthlyPmt > 0) return mthlyPmt * 12;                      // use contractual payment
  return amortPmt(bal, rate, amortPer) * 12;                   // fallback: compute from balance
}

/*
 * Debt NPV — PV of all actual cash obligations to the lender:
 *
 *   Phase 1: IO payments for ioYears
 *   Phase 2: P&I payments for (loanTerm − ioYears) years, based on 30-yr amort schedule
 *   Balloon: remaining balance on 30-yr schedule at end of loanTerm, due at maturity
 *
 * All discounted at the current market rate (getDR()) to today.
 */
function calcDebtNPV(prop) {
  var bal      = nv(prop.loanBal);
  var rate     = nv(prop.loanRate) / 100;
  var ioYears  = nv(prop.ioYears);
  var loanTerm = nv(prop.loanTerm);
  var amortPer = nv(prop.amortPeriod) || 30;
  var dr       = getDR();

  if (bal <= 0) return 0;
  if (loanTerm <= 0 && ioYears <= 0) return bal;   // no term info — fall back to balance

  var mdr      = dr / 12;
  var ioM      = Math.round(ioYears * 12);
  var piYears  = Math.max(0, loanTerm - ioYears);  // years of P&I before balloon
  var piM      = Math.round(piYears * 12);

  // ── Phase 1: IO payments ──────────────────────────────────────
  var ioPmt = bal * rate / 12;
  var pvIO  = 0;
  if (ioM > 0) {
    pvIO = (mdr === 0) ? ioPmt * ioM : ioPmt * (1 - Math.pow(1 + mdr, -ioM)) / mdr;
  }

  // ── Phase 2: P&I payments (contractual or computed) ───────────
  var mthlyPmt = nv(prop.monthlyPmt);
  var pmt   = mthlyPmt > 0 ? mthlyPmt : amortPmt(bal, rate, amortPer);
  var pvPI  = 0;
  if (piM > 0 && pmt > 0) {
    var pvPIatStart = (mdr === 0) ? pmt * piM : pmt * (1 - Math.pow(1 + mdr, -piM)) / mdr;
    pvPI = pvPIatStart / Math.pow(1 + mdr, ioM);   // discount back through IO period
  }

  // ── Balloon at end of loanTerm ────────────────────────────────
  // Remaining balance: use contractual payment if provided, else compute
  var pmtForBal = mthlyPmt > 0 ? mthlyPmt : amortPmt(bal, rate, amortPer);
  var balloon   = remainingBalanceFromPmt(bal, rate, pmtForBal, piYears);
  var pvBalloon = (loanTerm > 0)
    ? balloon / Math.pow(1 + mdr, Math.round(loanTerm * 12))
    : 0;

  return pvIO + pvPI + pvBalloon;
}

function calcAMV(prop)       { return nv(prop.marketVal) - nv(prop.capex); }

function calcLTV(prop) {
  var mv = nv(prop.marketVal);
  if (mv <= 0) return 0;
  return (nv(prop.loanBal) / mv) * 100;
}

function calcNPVEquity(prop) { return calcAMV(prop) - calcDebtNPV(prop); }
function calcNCF(prop)       { return nv(prop.noi) - calcADS(prop); }
var cases = [
  { name:'123 Main St', marketVal:850000, capex:35000, noi:58000, monthlyPmt:39833.90, loanBal:420000, loanRate:3.25, amortPeriod:30, ioYears:0, loanTerm:7, bidDiff:15000, remainingBasis:610000 },
  { name:'Sunset Plaza', marketVal:1200000, capex:80000, noi:84000, monthlyPmt:3200, loanBal:680000, loanRate:6.75, amortPeriod:30, ioYears:0, loanTerm:5, bidDiff:-8000, remainingBasis:860000 },
  { name:'Oak Valley', marketVal:2100000, capex:120000, noi:148000, monthlyPmt:4500, loanBal:1050000, loanRate:4.5, amortPeriod:30, ioYears:3, loanTerm:10, bidDiff:0, remainingBasis:1520000 },
  { name:'Harbor View', marketVal:950000, capex:55000, noi:62000, monthlyPmt:'', loanBal:310000, loanRate:7.10, amortPeriod:30, ioYears:0, loanTerm:5, bidDiff:22000, remainingBasis:640000 },
  { name:'IO only, no term', marketVal:500000, capex:'', noi:30000, monthlyPmt:'', loanBal:200000, loanRate:5, amortPeriod:'', ioYears:2, loanTerm:'', bidDiff:'', remainingBasis:'' },
  { name:'No loan', marketVal:400000, capex:10000, noi:25000, monthlyPmt:'', loanBal:'', loanRate:'', amortPeriod:30, ioYears:0, loanTerm:'', bidDiff:'', remainingBasis:'' },
  { name:'No term info', marketVal:400000, capex:0, noi:25000, monthlyPmt:'', loanBal:150000, loanRate:6, amortPeriod:30, ioYears:0, loanTerm:0, bidDiff:'', remainingBasis:'' },
  { name:'Zero rate', marketVal:600000, capex:0, noi:40000, monthlyPmt:'', loanBal:240000, loanRate:0, amortPeriod:20, ioYears:1, loanTerm:6, bidDiff:'', remainingBasis:'' },
];
var out = [];
[0.065, 0, 0.1].forEach(function(dr){ _dr = dr; cases.forEach(function(c){
  out.push({ dr:dr, name:c.name, amv:calcAMV(c), ltv:calcLTV(c), ads:calcADS(c), debtNpv:calcDebtNPV(c), npvEquity:calcNPVEquity(c), ncf:calcNCF(c) });
});});
console.log(JSON.stringify(out, null, 1));
