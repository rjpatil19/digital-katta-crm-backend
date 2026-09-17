export interface RecommendationInput {
  score: number;
  criticalIssuesCount: number; // Written-off, Settled, Suit-Filed, DPD > 90
  minorIssuesCount: number;    // Phantom accounts, spelling mismatch, DPD 30-60
  utilizationRatio: number;    // e.g. 58.5%
  activeLoanAccounts?: number;
}

export interface RecommendationResult {
  recommendedPackageCode: 'BASIC_AUDIT' | 'STANDARD_DISPUTE' | 'PREMIUM_HANDHOLDING';
  rationaleEn: string;
  rationaleMr: string;
  confidenceScore: number;
  estimatedResolutionDays: number;
  potentialScoreGain: {
    min: number;
    max: number;
  };
}

export function evaluatePackageRecommendation(input: RecommendationInput): RecommendationResult {
  const { score, criticalIssuesCount, minorIssuesCount, utilizationRatio } = input;

  // Rule 1: High severity / severely damaged credit -> Premium Handholding
  if (criticalIssuesCount >= 2 || score < 630) {
    return {
      recommendedPackageCode: 'PREMIUM_HANDHOLDING',
      rationaleEn: `Detected ${criticalIssuesCount} severe tradelines (Write-Off / Settlement remarks). Requires persistent bank nodal escalation, RBI Ombudsman readiness, and structured repayment restructuring.`,
      rationaleMr: `${criticalIssuesCount} गंभीर खाती (राईट-ऑफ / सेटलमेंट शेरा) आढळली. बँक प्रिन्सिपल नोडल अधिकारी स्तरावर थेट पाठपुरावा आणि दीर्घकालीन मार्गदर्शनाची गरज आहे.`,
      confidenceScore: 0.94,
      estimatedResolutionDays: 120,
      potentialScoreGain: {
        min: 80,
        max: 130
      }
    };
  }

  // Rule 2: Moderate issues / 1 critical / high utilization -> Standard Dispute Support
  if (criticalIssuesCount === 1 || minorIssuesCount >= 2 || utilizationRatio > 40 || score < 720) {
    return {
      recommendedPackageCode: 'STANDARD_DISPUTE',
      rationaleEn: `Inaccuracies detected in ${minorIssuesCount + criticalIssuesCount} accounts alongside revolving credit utilization at ${Math.round(utilizationRatio)}%. Recommended for formal Section 21 dispute notices and bureau rectification.`,
      rationaleMr: `${minorIssuesCount + criticalIssuesCount} खात्यांमध्ये त्रुटी आणि क्रेडिट कार्ड वापर प्रमाण (${Math.round(utilizationRatio)}%) जास्त आहे. कलम २१ अन्वये सिबिल तक्रार आणि सुधारणा आवश्यक आहे.`,
      confidenceScore: 0.89,
      estimatedResolutionDays: 60,
      potentialScoreGain: {
        min: 45,
        max: 85
      }
    };
  }

  // Rule 3: Minor optimization or good score -> Basic Bureau Audit
  return {
    recommendedPackageCode: 'BASIC_AUDIT',
    rationaleEn: 'Healthy score profile with minor optimization scope. Automated single-bureau hygiene audit and card balance rebalancing strategy is recommended.',
    rationaleMr: 'सिबिल स्कोअर चांगल्या स्थितीत आहे. नियमित तपासणी आणि कार्ड वापर नियोजनाचा बेसिक प्लॅन पुरेसा आहे.',
    confidenceScore: 0.92,
    estimatedResolutionDays: 30,
    potentialScoreGain: {
      min: 20,
      max: 40
    }
  };
}
