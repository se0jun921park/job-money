/*
 * Year-by-year earnings model, age 18 through retirement at 65.
 *
 * For each year a career is either in school (paying tuition, either
 * out of pocket or with federal loans that accrue interest), in paid
 * training (medical residency), or working (salary rising from the
 * starting figure to the peak figure on an ease-out curve, then flat).
 *
 * Loan repayment begins the first year after school and training end,
 * as a fixed annual payment that amortizes each balance over the
 * chosen term. Interest accrues through school and residency.
 *
 * "Net position" at the end of a year is:
 *   cumulative earnings - tuition paid out of pocket - loan payments - loan balance still owed
 * At 65 the balance is zero, so the final net position equals net
 * lifetime earnings after loan repayment.
 */
(function (root) {
  "use strict";

  const START_AGE = 18;
  const RETIRE_AGE = 65;

  // 2025 federal brackets, single filer.
  const BRACKETS = [
    [11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24],
    [250525, 0.32], [626350, 0.35], [Infinity, 0.37],
  ];
  const STANDARD_DEDUCTION = 15750;
  const SS_WAGE_BASE = 176100;
  const STATE_RATE = 0.05; // flat stand-in for a typical state income tax

  function incomeTax(gross) {
    const taxable = Math.max(0, gross - STANDARD_DEDUCTION);
    let federal = 0;
    let lower = 0;
    for (const [upper, rate] of BRACKETS) {
      if (taxable <= lower) break;
      federal += (Math.min(taxable, upper) - lower) * rate;
      lower = upper;
    }
    const socialSecurity = Math.min(gross, SS_WAGE_BASE) * 0.062;
    const medicare = gross * 0.0145 + Math.max(0, gross - 200000) * 0.009;
    const state = taxable * STATE_RATE;
    return federal + socialSecurity + medicare + state;
  }

  function annualPayment(balance, rate, years) {
    if (balance <= 0) return 0;
    if (rate === 0) return balance / years;
    return (balance * rate) / (1 - Math.pow(1 + rate, -years));
  }

  function salaryAt(career, yearsWorked) {
    const f = Math.min(yearsWorked / career.yearsToPeak, 1);
    const eased = 1 - (1 - f) * (1 - f);
    return career.startSalary + (career.peakSalary - career.startSalary) * eased;
  }

  /**
   * @param career  one entry of CareerData.CAREERS
   * @param data    CareerData (tuition, rates, stipends)
   * @param opts    { schoolType: "public"|"private", borrowShare: 0..1,
   *                  repayYears: number, afterTax: boolean }
   */
  function simulate(career, data, opts) {
    const schoolYears = [];
    for (const stage of career.school) {
      const tuition = data.TUITION[stage.kind][opts.schoolType];
      const rateKey = stage.kind === "undergrad" ? "undergrad" : "graduate";
      for (let i = 0; i < stage.years; i++) schoolYears.push({ tuition, rateKey });
    }
    const trainingYears = career.training ? career.training.years : 0;
    const workStartIndex = schoolYears.length + trainingYears;
    const totalYears = RETIRE_AGE - START_AGE;

    const balance = { undergrad: 0, graduate: 0 };
    const payment = { undergrad: 0, graduate: 0 };
    let borrowed = 0;
    let educationCost = 0;
    let cumIncome = 0;
    let cumGross = 0;
    let cumOutOfPocket = 0;
    let cumLoanPaid = 0;

    // years[i] describes the year starting at age START_AGE + i.
    // position[i] is the net position at exact age START_AGE + i.
    const years = [];
    const position = [0];

    for (let i = 0; i < totalYears; i++) {
      const age = START_AGE + i;
      let phase;
      let gross = 0;
      let outOfPocket = 0;

      if (i < schoolYears.length) {
        phase = "school";
        const { tuition, rateKey } = schoolYears[i];
        const loan = tuition * opts.borrowShare;
        educationCost += tuition;
        borrowed += loan;
        balance[rateKey] += loan;
        outOfPocket = tuition - loan;
      } else if (i < workStartIndex) {
        phase = "training";
        gross = data.RESIDENT_STIPENDS[Math.min(i - schoolYears.length, data.RESIDENT_STIPENDS.length - 1)];
      } else {
        phase = "work";
        gross = salaryAt(career, i - workStartIndex);
      }

      if (i === workStartIndex) {
        for (const k of Object.keys(balance)) {
          payment[k] = annualPayment(balance[k], data.LOAN_RATES[k], opts.repayYears);
        }
      }

      let loanPaid = 0;
      for (const k of Object.keys(balance)) {
        const withInterest = balance[k] * (1 + data.LOAN_RATES[k]);
        if (i >= workStartIndex && withInterest > 0) {
          const pay = Math.min(payment[k], withInterest);
          loanPaid += pay;
          balance[k] = withInterest - pay;
          if (balance[k] < 0.5) balance[k] = 0;
        } else {
          balance[k] = withInterest;
        }
      }

      const income = opts.afterTax ? gross - incomeTax(gross) : gross;
      cumGross += gross;
      cumIncome += income;
      cumOutOfPocket += outOfPocket;
      cumLoanPaid += loanPaid;
      const owed = balance.undergrad + balance.graduate;

      years.push({ age, phase, gross, income, outOfPocket, loanPaid, owed });
      position.push(cumIncome - cumOutOfPocket - cumLoanPaid - owed);
    }

    // Break-even: first age the net position climbs back to zero or above
    // after its low point.
    let low = 0;
    for (let i = 1; i < position.length; i++) if (position[i] < position[low]) low = i;
    let breakEvenAge = null;
    for (let i = low; i < position.length; i++) {
      if (position[i] >= 0) {
        // Interpolate within the year for a smoother reading.
        const prev = position[i - 1];
        const frac = i > 0 && prev < 0 ? -prev / (position[i] - prev) : 0;
        breakEvenAge = START_AGE + i - 1 + frac;
        break;
      }
    }

    const finalPosition = position[position.length - 1];
    return {
      career,
      years,
      position,
      schoolYears: schoolYears.length,
      trainingYears,
      workStartAge: START_AGE + workStartIndex,
      educationCost,
      borrowed,
      loanPaid: cumLoanPaid,
      interestPaid: Math.max(0, cumLoanPaid - borrowed),
      outOfPocket: cumOutOfPocket,
      lifetimeGross: cumGross,
      lifetimeIncome: cumIncome,
      netLifetime: finalPosition,
      lowPoint: position[low],
      lowAge: START_AGE + low,
      breakEvenAge,
    };
  }

  const api = { START_AGE, RETIRE_AGE, simulate, incomeTax, salaryAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CareerModel = api;
})(typeof window !== "undefined" ? window : globalThis);
