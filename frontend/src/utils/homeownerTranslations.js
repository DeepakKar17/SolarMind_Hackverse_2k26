/**
/**
 * SolarMind Homeowner Multilingual Translation & Plain Language Dictionary
 * Supports English (en), Hindi (hi - हिंदी), and Odia (or - ଓଡ଼ିଆ).
 */

export const HOMEOWNER_TRANSLATIONS = {
  en: {
    // Header & Brand
    portalTitle: 'Homeowner Solar Portal',
    portalSubtitle: 'Real-time overview, simple explanations, and health monitoring for your rooftop solar system.',
    welcomeUser: 'Welcome back',
    systemStatus: 'System Status',
    language: 'Language',
    demoModeTag: 'Demo Simulation Mode',
    liveTelemetry: 'Live Telemetry Active',
    staleData: 'Telemetry Data Stale (>1 hr)',
    offlineData: 'Inverter Offline / Night Mode',
    insufficientEvidence: 'Insufficient Evidence for Score',
    selectPlant: 'Select Rooftop Array',
    
    // KPI Cards
    currentPower: 'Current Power Output',
    currentPowerSub: 'Solar electricity generated right now',
    todayYield: "Today's Total Generation",
    todayYieldSub: 'Units (kWh) produced since sunrise',
    expectedVsActual: 'Expected vs Actual Yield',
    expectedVsActualSub: 'Performance compared to sunny clear-sky model',
    energyShortfall: 'Daily Energy Shortfall',
    energyShortfallSub: 'Lost units due to shading, dust, or clipping',
    financialSavings: 'Estimated Solar Savings / Loss',
    financialSavingsSub: 'Financial value calculated at grid export tariff',
    healthScore: 'Overall Solar Health Score',
    healthScoreSub: 'Hardware condition based on telemetry & AI analysis',
    activeAlerts: 'Active Solar Alerts',
    activeAlertsSub: 'Unresolved warnings requiring attention',
    pendingMaintenance: 'Pending Maintenance',
    pendingMaintenanceSub: 'Upcoming cleaning or technician appointments',

    // Health Score Labels
    healthExcellent: 'Excellent Condition',
    healthGood: 'Good Operating State',
    healthFair: 'Degraded / Needs Cleaning',
    healthPoor: 'Needs Immediate Inspection',
    healthInsufficient: 'Calibrating Baselines...',

    // Units & Formats
    unitsKwh: 'kWh (Units)',
    unitsKw: 'kW (Power)',
    inrSymbol: '₹',
    tariffRate: 'Grid Tariff Rate',

    // Charts
    chartDailyTitle: "Today's Power Generation Curve",
    chartDailySub: 'How your rooftop power output matches the expected sunlight profile throughout the day.',
    chartTrendsTitle: 'Weekly & Monthly Energy Trends',
    chartTrendsSub: 'Historical daily generation (kWh) for the last 7 to 30 days.',
    chartLossTitle: 'Daily Energy Loss & Reasons',
    chartLossSub: 'Estimated units lost each day categorized by root cause.',
    chartWeatherTitle: 'Weather & Sunlight Comparison',
    chartWeatherSub: 'Solar sunlight intensity (Irradiance) compared against actual power produced.',
    actualOutput: 'Actual Power Output',
    expectedBaseline: 'Expected Baseline',
    sunlightIrradiance: 'Sunlight Intensity (W/m²)',
    energyLost: 'Energy Lost',
    moneyLost: 'Money Lost (₹)',

    // Plain Language AI Diagnosis
    aiDiagnosisTitle: 'Plain-Language AI Solar Diagnosis',
    aiDiagnosisSub: 'Easy-to-understand explanations of any detected issues with clear recommended steps.',
    whatObserved: '1. What was observed?',
    whyHappening: '2. Why is this happening?',
    supportingEvidence: '3. What is the evidence?',
    confidenceScore: '4. AI System Confidence',
    whatToDoNext: '5. What should you do next?',
    technicianRequired: '6. Is a qualified technician required?',
    techYes: 'Yes - Technician Service Recommended',
    techNo: 'No - Simple Homeowner Action Sufficient',
    requestTechVisit: 'Request Technician Visit',
    uploadPhotoAction: 'Upload Rooftop Photo for Verification',
    markResolved: 'Mark as Acknowledged',

    // Plant & Inverter Details
    plantProfileTitle: 'Rooftop System & Inverter Profile',
    plantProfileSub: 'Technical specifications, serial numbers, and grid synchronization details.',
    systemCapacity: 'System Capacity',
    inverterModel: 'Inverter Model',
    serialNumber: 'Serial Number',
    panelCount: 'Number of Panels',
    gridConnection: 'Grid Connection Status',
    installationDate: 'Installation Date',
    warrantyStatus: 'Warranty Coverage',
    warrantyActive: 'Active (5-Year Inverter / 25-Year Panels)',

    // Tools & Actions
    recentAlertsTitle: 'Recent Alerts & Notifications',
    recentAlertsSub: 'Security and yield events recorded by the monitoring system.',
    workOrderTrackerTitle: 'Maintenance & Service Status',
    workOrderTrackerSub: 'Track active repair requests and cleaning visits in real-time.',
    reportsTitle: 'Energy Statements & Download',
    reportsSub: 'Download detailed monthly solar generation and savings statements.',
    downloadCsv: 'Download CSV Data',
    downloadReport: 'Download Monthly PDF Statement',
    userPreferencesTitle: 'Homeowner Preferences',
    notifications: 'Notification Channels',
    whatsappAlerts: 'WhatsApp Generation Summaries',
    smsAlerts: 'Urgent SMS Fault Alerts',
    emailReports: 'Monthly Email Statements',
    savePreferences: 'Save Preferences',

    // Glossary Tooltips
    glossaryKwp: 'kWp (Kilowatt-peak): The maximum power output of your solar panels in peak sunlight.',
    glossaryKwh: 'kWh (Kilowatt-hour): A standard unit of electricity equal to running a 1,000-watt appliance for one hour.',
    glossaryShading: 'Shading: Shadows from trees, walls, or chimneys blocking sunlight, causing string current drops.',
    glossarySoiling: 'Soiling: Dust, bird droppings, or pollution film covering solar glass and blocking light.',
    glossaryTariff: 'Tariff: The rate per unit (kWh) agreed with your local electricity board (DISCOM) for net metering.',
    glossaryInverter: 'Inverter: The core electronic box converting DC electricity from panels into AC electricity for home use.',
  },

  hi: {
    // Header & Brand
    portalTitle: 'सौर ऊर्जा गृहस्वामी पोर्टल',
    portalSubtitle: 'आपके छत के सोलर सिस्टम का सरल विश्लेषण, लाइव उत्पादन और स्वास्थ्य निगरानी।',
    welcomeUser: 'स्वागत है',
    systemStatus: 'सिस्टम स्थिति',
    language: 'भाषा',
    demoModeTag: 'डेमो सिमुलेशन मोड',
    liveTelemetry: 'लाइव टेलीमेट्री सक्रिय',
    staleData: 'डेटा पुराना है (>1 घंटा)',
    offlineData: 'इन्वर्टर ऑफलाइन / रात का समय',
    insufficientEvidence: 'स्कोर के लिए पर्याप्त डेटा नहीं',
    selectPlant: 'सोलर प्लांट चुनें',

    // KPI Cards
    currentPower: 'वर्तमान सौर ऊर्जा उत्पादन',
    currentPowerSub: 'इस समय सोलर पैनलों द्वारा बनाई जा रही बिजली',
    todayYield: 'आज का कुल उत्पादन',
    todayYieldSub: 'सूर्योदय से अब तक बनी कुल बिजली यूनिट्स (kWh)',
    expectedVsActual: 'अपेक्षित बनाम वास्तविक उत्पादन',
    expectedVsActualSub: 'धूप के अनुसार अपेक्षित उत्पादन की तुलना',
    energyShortfall: 'आज का बिजली नुकसान',
    energyShortfallSub: 'छाया, धूल या तकनीकी कारणों से कम बनी यूनिट्स',
    financialSavings: 'अनुमानित वित्तीय बचत / नुकसान',
    financialSavingsSub: 'ग्रिड बिजली दर के आधार पर गणना की गई राशि',
    healthScore: 'सोलर सिस्टम स्वास्थ्य स्कोर',
    healthScoreSub: 'हार्डवेयर और पैनलों की कार्यकुशलता स्कोर (100 में से)',
    activeAlerts: 'सक्रिय चेतावनियाँ',
    activeAlertsSub: 'तत्काल ध्यान देने योग्य चेतावनियाँ',
    pendingMaintenance: 'लंबित रखरखाव',
    pendingMaintenanceSub: 'पैनल सफाई या तकनीशियन की निर्धारित विज़िट',

    // Health Score Labels
    healthExcellent: 'उत्कृष्ट स्थिति',
    healthGood: 'अच्छी कार्यप्रणाली',
    healthFair: 'सफाई की आवश्यकता है',
    healthPoor: 'तत्काल तकनीशियन जांच आवश्यक',
    healthInsufficient: 'डेटा कैलिब्रेट हो रहा है...',

    // Units & Formats
    unitsKwh: 'यूनिट (kWh)',
    unitsKw: 'किलोवाट (kW)',
    inrSymbol: '₹',
    tariffRate: 'बिजली ग्रिड दर',

    // Charts
    chartDailyTitle: 'आज का ऊर्जा उत्पादन चार्ट',
    chartDailySub: 'सुबह से शाम तक वास्तविक और अपेक्षित बिजली उत्पादन का ग्राफ।',
    chartTrendsTitle: 'साप्ताहिक और मासिक बिजली रुझान',
    chartTrendsSub: 'पिछले 7 से 30 दिनों का दैनिक बिजली उत्पादन (यूनिट्स में)।',
    chartLossTitle: 'दैनिक बिजली नुकसान और कारण',
    chartLossSub: 'धूल, छाया या वोल्टेज के कारण प्रतिदिन कम बनी यूनिट्स।',
    chartWeatherTitle: 'धूप (मौसम) और बिजली की तुलना',
    chartWeatherSub: 'सूरज की रोशनी की तीव्रता और सोलर उत्पादन का तालमेल।',
    actualOutput: 'वास्तविक उत्पादन',
    expectedBaseline: 'अपेक्षित बेसलाइन',
    sunlightIrradiance: 'धूप की तीव्रता (W/m²)',
    energyLost: 'खोई हुई बिजली',
    moneyLost: 'वित्तीय नुकसान (₹)',

    // Plain Language AI Diagnosis
    aiDiagnosisTitle: 'सरल भाषा में AI सोलर रिपोर्ट व डायग्नोसिस',
    aiDiagnosisSub: 'सोलर सिस्टम की समस्याओं का आसान भाषा में कारण और समाधान।',
    whatObserved: '1. सिस्टम में क्या देखा गया?',
    whyHappening: '2. यह समस्या क्यों हो रही है?',
    supportingEvidence: '3. इसका तकनीकी सबूत क्या है?',
    confidenceScore: '4. AI सिस्टम का विश्वास स्तर',
    whatToDoNext: '5. अब आपको क्या करना चाहिए?',
    technicianRequired: '6. क्या तकनीशियन की ज़रूरत है?',
    techYes: 'हाँ - तकनीशियन द्वारा जांच आवश्यक है',
    techNo: 'नहीं - आप स्वयं आसान सफाई कर सकते हैं',
    requestTechVisit: 'तकनीशियन विज़िट का अनुरोध करें',
    uploadPhotoAction: 'जांच के लिए सोलर पैनल का फोटो भेजें',
    markResolved: 'स्वीकार करें',

    // Plant & Inverter Details
    plantProfileTitle: 'सोलर प्लांट और इन्वर्टर विवरण',
    plantProfileSub: 'सिस्टम क्षमता, सीरियल नंबर और ग्रिड कनेक्शन की स्थिति।',
    systemCapacity: 'सिस्टम क्षमता',
    inverterModel: 'इन्वर्टर मॉडल',
    serialNumber: 'सीरियल नंबर',
    panelCount: 'पैनलों की संख्या',
    gridConnection: 'ग्रिड कनेक्शन स्थिति',
    installationDate: 'स्थापना तिथि',
    warrantyStatus: 'वारंटी कवरेज',
    warrantyActive: 'सक्रिय (5 वर्ष इन्वर्टर / 25 वर्ष पैनल)',

    // Tools & Actions
    recentAlertsTitle: 'हाल की चेतावनियाँ और सूचनाएं',
    recentAlertsSub: 'सोलर सिस्टम द्वारा दर्ज की गई सुरक्षा चेतावनियां।',
    workOrderTrackerTitle: 'सेवा और मरम्मत की स्थिति',
    workOrderTrackerSub: 'तकनीशियन विज़िट और पैनल सफाई का लाइव स्टेटस।',
    reportsTitle: 'मासिक बिजली बिल और बचत स्टेटमेंट',
    reportsSub: 'मासिक बिजली उत्पादन और बचत की रिपोर्ट डाउनलोड करें।',
    downloadCsv: 'CSV डेटा डाउनलोड करें',
    downloadReport: 'मासिक PDF रिपोर्ट डाउनलोड करें',
    userPreferencesTitle: 'उपयोगकर्ता प्राथमिकताएं',
    notifications: 'सूचना माध्यम',
    whatsappAlerts: 'व्हाट्सएप पर दैनिक उत्पादन सारांश',
    smsAlerts: 'ज़रूरी एसएमएस अलर्ट',
    emailReports: 'मासिक ईमेल रिपोर्ट',
    savePreferences: 'प्राथमिकताएं सहेजें',

    // Glossary Tooltips
    glossaryKwp: 'kWp (किलोवाट-पीक): तेज धूप में आपके सोलर पैनलों द्वारा बनने वाली अधिकतम बिजली क्षमता।',
    glossaryKwh: 'kWh (किलोवाट-घंटा): बिजली का 1 यूनिट (1000 वॉट के उपकरण को 1 घंटा चलाने के बराबर)।',
    glossaryShading: 'छाया (Shading): पेड़ों या दीवारों की परछाई से पैनल पर धूप कम होना।',
    glossarySoiling: 'धूल/मैल (Soiling): सोलर ग्लास पर जमी धूल जिससे धूप रुक जाती है।',
    glossaryTariff: 'टैरिफ (Tariff): ग्रिड को बेची गई बिजली का सरकारी रेट (प्रति यूनिट ₹)।',
    glossaryInverter: 'इन्वर्टर: वह बॉक्स जो सोलर पैनल की डीसी बिजली को घर में इस्तेमाल होने वाली एसी बिजली में बदलता है।',
  },

  or: {
    // Header & Brand
    portalTitle: 'ସୌର ଶକ୍ତି ଗୃହସ୍ୱାମୀ ପୋର୍ଟାଲ',
    portalSubtitle: 'ଆପଣଙ୍କ ଛାତ ସୋଲାର ସିଷ୍ଟମର ସରଳ ବିବରଣୀ, ଲାଇଭ୍ ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନ ଏବଂ ସ୍ୱାସ୍ଥ୍ୟ ନିରୀକ୍ଷଣ।',
    welcomeUser: 'ସ୍ୱାଗତ',
    systemStatus: 'ସିଷ୍ଟମ ସ୍ଥିତି',
    language: 'ଭାଷା',
    demoModeTag: 'ଡେମୋ ସିମ୍ୟୁଲେସନ ମୋଡ୍',
    liveTelemetry: 'ଲାଇଭ୍ ଟେଲିମେଟ୍ରି ସକ୍ରିୟ',
    staleData: 'ଡାଟା ପୁରୁଣା ଅଟେ (>୧ ଘଣ୍ଟା)',
    offlineData: 'ଇନଭର୍ଟର ଅଫଲାଇନ୍ / ରାତ୍ରି ସମୟ',
    insufficientEvidence: 'ସ୍କୋର ପାଇଁ ପର୍ଯ୍ୟାପ୍ତ ତଥ୍ୟ ନାହିଁ',
    selectPlant: 'ସୋଲାର ପ୍ଲାଣ୍ଟ ବାଛନ୍ତୁ',

    // KPI Cards
    currentPower: 'ବର୍ତ୍ତମାନ ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନ',
    currentPowerSub: 'ଏହି ମୁହୂର୍ତ୍ତରେ ସୋଲାର ପ୍ୟାନେଲ ଦ୍ୱାରା ତିଆରି ହେଉଥିବା ବିଦ୍ୟୁତ୍',
    todayYield: 'ଆଜିର ମୋଟ ଉତ୍ପାଦନ',
    todayYieldSub: 'ସୂର୍ଯ୍ୟୋଦୟ ଠାରୁ ଏପର୍ଯ୍ୟନ୍ତ ତିଆରି ହୋଇଥିବା ବିଦ୍ୟୁତ୍ ୟୁନିଟ୍ (kWh)',
    expectedVsActual: 'ଅନୁମାନିତ ବନାମ ପ୍ରକୃତ ଉତ୍ପାଦନ',
    expectedVsActualSub: 'ଖରା ଅନୁସାରେ ଆଶା କରାଯାଉଥିବା ଉତ୍ପାଦନ ସହିତ ତୁଳନା',
    energyShortfall: 'ଆଜିର ବିଦ୍ୟୁତ୍ କ୍ଷତି',
    energyShortfallSub: 'ଛାଇ କିମ୍ବା ଧୂଳି କାରଣରୁ କମ୍ ହୋଇଥିବା ୟୁନିଟ୍',
    financialSavings: 'ଆନୁମାନିକ ସଞ୍ଚୟ / ଆର୍ଥିକ କ୍ଷତି',
    financialSavingsSub: 'ଗ୍ରିଡ୍ ବିଦ୍ୟୁତ୍ ଦର ଅନୁସାରେ ହିସାବ କରାଯାଇଥିବା ଟଙ୍କା',
    healthScore: 'ସୋଲାର ସିଷ୍ଟମ ସ୍ୱାସ୍ଥ୍ୟ ସ୍କୋର',
    healthScoreSub: 'ପ୍ୟାନେଲ ଓ ଇନଭର୍ଟର କାର୍ଯ୍ୟକ୍ଷମତା ସ୍କୋର (୧୦୦ ରୁ)',
    activeAlerts: 'ସକ୍ରିୟ ସତର୍କତା',
    activeAlertsSub: 'ଧ୍ୟାନ ଦେବା ଯୋଗ୍ୟ ଚେତାବନୀ',
    pendingMaintenance: 'ବାକି ରହିଥିବା ରକ୍ଷଣାବେକ୍ଷଣ',
    pendingMaintenanceSub: 'ପ୍ୟାନେଲ ସଫା କିମ୍ବା ଟେକ୍ନିସିଆନ୍ ପରିଦର୍ଶନ',

    // Health Score Labels
    healthExcellent: 'ଉତ୍କୃଷ୍ଟ ସ୍ଥିତି',
    healthGood: 'ଭଲ କାର୍ଯ୍ୟକ୍ଷମତା',
    healthFair: 'ସଫେଇ ଆବଶ୍ୟକ',
    healthPoor: 'ତୁରନ୍ତ ଟେକ୍ନିସିଆନ୍ ଦେଖାଇବା ଦରକାର',
    healthInsufficient: 'ଡାଟା ଗଣନା ଚାଲିଛି...',

    // Units & Formats
    unitsKwh: 'ୟୁନିଟ୍ (kWh)',
    unitsKw: 'କିଲୋୱାଟ୍ (kW)',
    inrSymbol: '₹',
    tariffRate: 'ଗ୍ରିଡ୍ ବିଦ୍ୟୁତ୍ ଦର',

    // Charts
    chartDailyTitle: 'ଆଜିର ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନ ଚାର୍ଟ',
    chartDailySub: 'ସକାଳୁ ସନ୍ଧ୍ୟା ପର୍ଯ୍ୟନ୍ତ ପ୍ରକୃତ ଓ ଆଶା କରାଯାଉଥିବା ବିଦ୍ୟୁତ୍ ଗ୍ରାଫ୍।',
    chartTrendsTitle: 'ସାପ୍ତାହିକ ଓ ମାସିକ ଧାରା',
    chartTrendsSub: 'ଗତ ୭ ରୁ ୩୦ ଦିନର ଦୈନିକ ଉତ୍ପାଦନ (ୟୁନିଟ୍ ରେ)।',
    chartLossTitle: 'ଦୈନିକ ବିଦ୍ୟୁତ୍ କ୍ଷତି ଓ କାରଣ',
    chartLossSub: 'ଧୂଳି, ଛାଇ କିମ୍ବା ଅନ୍ୟାନ୍ୟ କାରଣରୁ କମ୍ ହୋଇଥିବା ୟୁନିଟ୍।',
    chartWeatherTitle: 'ଖରା (ପାଗ) ଏବଂ ଉତ୍ପାଦନ ତୁଳନା',
    chartWeatherSub: 'ସୂର୍ଯ୍ୟ କିରଣର ତୀବ୍ରତା ସହିତ ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନର ତାଳମେଳ।',
    actualOutput: 'ପ୍ରକୃତ ଉତ୍ପାଦନ',
    expectedBaseline: 'ଆଶା କରାଯାଉଥିବା ବେସଲାଇନ୍',
    sunlightIrradiance: 'ସୂର୍ଯ୍ୟ କିରଣ ତୀବ୍ରତା (W/m²)',
    energyLost: 'ହରାଇଥିବା ବିଦ୍ୟୁତ୍',
    moneyLost: 'ଆର୍ଥିକ କ୍ଷତି (₹)',

    // Plain Language AI Diagnosis
    aiDiagnosisTitle: 'ସରଳ ଭାଷାରେ AI ସୋଲାର ଡାଇଗ୍ନୋସିସ୍ ରିପୋର୍ଟ',
    aiDiagnosisSub: 'ସୋଲାର ସିଷ୍ଟମରେ ଦେଖାଦେଇଥିବା ସମସ୍ୟାର ସହଜ ବୁଝାମଣା ଏବଂ ସମାଧାନ।',
    whatObserved: '୧. ସିଷ୍ଟମରେ କ’ଣ ଲକ୍ଷ୍ୟ କରାଗଲା?',
    whyHappening: '୨. ଏହି ସମସ୍ୟା କାହିଁକି ହେଉଛି?',
    supportingEvidence: '୩. ଏହାର ବୈଷୟିକ ପ୍ରମାଣ କ’ଣ?',
    confidenceScore: '୪. AI ସିଷ୍ଟମର ବିଶ୍ୱାସ ସ୍ତର',
    whatToDoNext: '୫. ବର୍ତ୍ତମାନ ଆପଣ କ’ଣ କରିବା ଉଚିତ୍?',
    technicianRequired: '୬. ଟେକ୍ନିସିଆନ୍ ଆବଶ୍ୟକ କି?',
    techYes: 'ହଁ - ଟେକ୍ନିସିଆନ୍ ପରିଦର୍ଶନ ଆବଶ୍ୟକ',
    techNo: 'ନାହିଁ - ଆପଣ ନିଜେ ସହଜରେ ସଫା କରିପାରିବେ',
    requestTechVisit: 'ଟେକ୍ନିସିଆନ୍ ପରିଦର୍ଶନ ଅନୁରୋଧ କରନ୍ତୁ',
    uploadPhotoAction: 'ପରୀକ୍ଷା ପାଇଁ ସୋଲାର ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ',
    markResolved: 'ଗ୍ରହଣ କରନ୍ତୁ',

    // Plant & Inverter Details
    plantProfileTitle: 'ସୋଲାର ପ୍ଲାଣ୍ଟ ଓ ଇନଭର୍ଟର ବିବରଣୀ',
    plantProfileSub: 'ସିଷ୍ଟମ କ୍ଷମତା, ସିରିୟଲ ନମ୍ବର ଏବଂ ଗ୍ରିଡ୍ ସଂଯୋଗ ସ୍ଥିତି।',
    systemCapacity: 'ସିଷ୍ଟମ କ୍ଷମତା',
    inverterModel: 'ଇନଭର୍ଟର ମଡେଲ',
    serialNumber: 'ସିରିୟଲ ନମ୍ବର',
    panelCount: 'ପ୍ୟାନେଲ ସଂଖ୍ୟା',
    gridConnection: 'ଗ୍ରିଡ୍ ସଂଯୋଗ ସ୍ଥିତି',
    installationDate: 'ସ୍ଥାପନା ତାରିଖ',
    warrantyStatus: 'ୱାରେଣ୍ଟି କଭରେଜ୍',
    warrantyActive: 'ସକ୍ରିୟ (୫ ବର୍ଷ ଇନଭର୍ଟର / ୨୫ ବର୍ଷ ପ୍ୟାନେଲ)',

    // Tools & Actions
    recentAlertsTitle: 'ସମ୍ପ୍ରତି ସତର୍କତା ଓ ସୂଚନା',
    recentAlertsSub: 'ସିଷ୍ଟମ ଦ୍ୱାରା ରେକର୍ଡ କରାଯାଇଥିବା ସୁରକ୍ଷା ସତର୍କତା।',
    workOrderTrackerTitle: 'ସେବା ଏବଂ ମରାମତି ସ୍ଥିତି',
    workOrderTrackerSub: 'ଟେକ୍ନିସିଆନ୍ ଭିଜିଟ୍ ଏବଂ ପ୍ୟାନେଲ ସଫେଇ ସ୍ଥିତି।',
    reportsTitle: 'ମାସିକ ବିଦ୍ୟୁତ୍ ବିଲ୍ ଏବଂ ସଞ୍ଚୟ ଷ୍ଟେଟମେଣ୍ଟ',
    reportsSub: 'ମାସିକ ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନ ରିପୋର୍ଟ ଡାଉନଲୋଡ୍ କରନ୍ତୁ।',
    downloadCsv: 'CSV ଡାଟା ଡାଉନଲୋଡ୍ କରନ୍ତୁ',
    downloadReport: 'ମାସିକ PDF ଷ୍ଟେଟମେଣ୍ଟ ଡାଉନଲୋଡ୍ କରନ୍ତୁ',
    userPreferencesTitle: 'ଉପଭୋକ୍ତା ପସନ୍ଦ',
    notifications: 'ସୂଚନା ମାଧ୍ୟମ',
    whatsappAlerts: 'ହ୍ୱାଟ୍ସଆପ୍ ରେ ଦୈନିକ ରିପୋର୍ଟ',
    smsAlerts: 'ଜରୁରୀ SMS ସତର୍କତା',
    emailReports: 'ମାସିକ ଇମେଲ୍ ରିପୋର୍ଟ',
    savePreferences: 'ପସନ୍ଦ ସାଇତି ରଖନ୍ତୁ',

    // Glossary Tooltips
    glossaryKwp: 'kWp (କିଲୋୱାଟ୍-ପିକ୍): ସର୍ବାଧିକ ଖରାରେ ପ୍ୟାନେଲ ଦ୍ୱାରା ଉତ୍ପନ୍ନ ହୋଇପାରୁଥିବା ସର୍ବାଧିକ ଶକ୍ତି।',
    glossaryKwh: 'kWh (କିଲୋୱାଟ୍-ଘଣ୍ଟା): ବିଦ୍ୟୁତର ୧ ୟୁନିଟ୍ (୧୦୦୦ ୱାଟ୍ ର ଯନ୍ତ୍ରକୁ ୧ ଘଣ୍ଟା ଚଲାଇବା ସହିତ ସମାନ)।',
    glossaryShading: 'ଛାଇ (Shading): ଗଛ କିମ୍ବା କାନ୍ଥର ଛାଇ ପ୍ୟାନେଲ ଉପରେ ପଡ଼ି ବିଦ୍ୟୁତ୍ କମାଇବା।',
    glossarySoiling: 'ଧୂଳି ଜମିବା (Soiling): ସୋଲାର ଗ୍ଲାସ ଉପରେ ଧୂଳି କିମ୍ବା ମଳ ଜମି ଆଲୋକ ଅବରୋଧ କରିବା।',
    glossaryTariff: 'ଦର (Tariff): ଗ୍ରିଡ୍ କୁ ବିକ୍ରି ହେଉଥିବା ବିଦ୍ୟୁତର ୟୁନିଟ୍ ପିଛା ସରକାରୀ ଦର (₹)।',
    glossaryInverter: 'ଇନଭର୍ଟର: ଏହି ଯନ୍ତ୍ର ସୋଲାର DC ବିଦ୍ୟୁତକୁ ଘରୋଇ AC ବିଦ୍ୟୁତରେ ପରିଣତ କରେ।',
  },
};

/**
 * Returns localized strings with fallback to English
 */
export const getHomeownerText = (lang = 'en') => {
  return HOMEOWNER_TRANSLATIONS[lang] || HOMEOWNER_TRANSLATIONS.en;
};
