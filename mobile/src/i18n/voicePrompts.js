// Translated prompts + action-word recognition for the guided voice flow.
// Every supported language (see VOICE_LANGS in voiceService.js) needs an
// entry here — if one is ever missing, English is used as a safe fallback
// rather than crashing or speaking blank text.

const EN = {
  start: '🗣 Start — Ask me about a medicine',
  subtitleGuided: "I'll ask which medicine, then what you'd like to do",
  subtitleFreeform: 'Say anything, e.g. "I took my medicine"',
  askMedicine: (list) => `Which medicine would you like to update? You can say a name like ${list}.`,
  retryMedicine: "Sorry, I didn't catch that medicine. Please try again, or tap one below.",
  gotItAskAction: (name) => `Got it — ${name}. Did you take it, skip it, or postpone the reminder?`,
  retryAction: "Sorry, please say 'took it', 'skip it', or 'postpone' — or tap a button below.",
  askDuration: 'How long should I wait before reminding you again — 15 minutes, 30 minutes, or 1 hour?',
  tookConfirm: (name) => `Marked ${name} as taken. Well done!`,
  skippedConfirm: (name) => `Okay, ${name} is marked as skipped for today.`,
  postponedConfirm: (name, min) => `Okay, I'll remind you about ${name} again in ${min} minutes.`,
  youSaid: 'You said:',
  tapToAnswer: 'Tap to answer',
  listening: 'Listening… tap to stop',
  speaking: 'Speaking…',
  anotherMedicine: 'Ask about another medicine',
};

// Action-word matchers are regex patterns tuned per language/script — kept
// separate from the prompt text since recognition needs to work even if the
// person answers in different words than the prompt used.
const ACTIONS = {
  'en-US': { skip: /\bskip/i, postpone: /\bpostpone|later|remind.*again|snooze/i, take: /\btook|taken|took it|^yes\b|\bdid\b/i },
  'hi-IN': { skip: /छोड़|स्किप/i, postpone: /बाद में|टाल|फिर से याद/i, take: /ले ली|लिया|हाँ|हां/i },
  'te-IN': { skip: /వదిలేయ|స్కిప్/i, postpone: /తర్వాత|వాయిదా/i, take: /తీసుకున్నాను|వేసుకున్నాను|అవును/i },
  'ta-IN': { skip: /தவிர்|ஸ்கிப்/i, postpone: /பின்னர்|ஒத்திவை/i, take: /எடுத்துக்கொண்டேன்|சாப்பிட்டேன்|ஆம்/i },
  'kn-IN': { skip: /ಬಿಟ್ಟುಬಿಡು|ಸ್ಕಿಪ್/i, postpone: /ನಂತರ|ಮುಂದೂಡು/i, take: /ತೆಗೆದುಕೊಂಡೆ|ಹೌದು/i },
  'ml-IN': { skip: /ഒഴിവാക്ക|സ്കിപ്പ്/i, postpone: /പിന്നീട്|മാറ്റിവയ്ക്ക/i, take: /കഴിച്ചു|അതെ/i },
  'mr-IN': { skip: /वगळा|स्किप/i, postpone: /नंतर|पुढे ढकल/i, take: /घेतले|होय/i },
  'bn-IN': { skip: /বাদ দিন|স্কিপ/i, postpone: /পরে|স্থগিত/i, take: /খেয়েছি|নিয়েছি|হ্যাঁ/i },
  'gu-IN': { skip: /છોડો|સ્કિપ/i, postpone: /પછી|મુલતવી/i, take: /લીધી|હા/i },
  'pa-IN': { skip: /ਛੱਡੋ|ਸਕਿਪ/i, postpone: /ਬਾਅਦ|ਮੁਲਤਵੀ/i, take: /ਲੈ ਲਈ|ਹਾਂ/i },
  'ur-IN': { skip: /چھوڑ|اسکپ/i, postpone: /بعد میں|ملتوی/i, take: /لے لی|ہاں/i },
  'es-ES': { skip: /\bomitir|saltar/i, postpone: /\bmás tarde|posponer/i, take: /\btomé|tomado|sí/i },
  'fr-FR': { skip: /\bpasser|ignorer/i, postpone: /\bplus tard|reporter/i, take: /\bpris|oui/i },
  'ar-SA': { skip: /تخطي|تجاوز/i, postpone: /لاحقا|أجل/i, take: /أخذت|نعم/i },
  'zh-CN': { skip: /跳过/i, postpone: /稍后|推迟/i, take: /吃了|服用了|是的/i },
  'pt-BR': { skip: /\bpular|ignorar/i, postpone: /\bmais tarde|adiar/i, take: /\btomei|sim/i },
};

const HI = {
  start: '🗣 शुरू करें — दवा के बारे में पूछें',
  subtitleGuided: 'मैं पूछूंगा कौन सी दवा, फिर आप क्या करना चाहते हैं',
  subtitleFreeform: 'कुछ भी कहें, जैसे "मैंने दवा ले ली"',
  askMedicine: (list) => `आप कौन सी दवा अपडेट करना चाहते हैं? आप नाम बोल सकते हैं, जैसे ${list}।`,
  retryMedicine: 'माफ़ कीजिए, समझ नहीं आया। कृपया फिर से बोलें, या नीचे टैप करें।',
  gotItAskAction: (name) => `ठीक है — ${name}। क्या आपने यह ली, छोड़ दी, या याद दिलाने को टाल दें?`,
  retryAction: "माफ़ कीजिए, कृपया 'ले ली', 'छोड़ दी', या 'टाल दें' कहें — या नीचे बटन दबाएं।",
  askDuration: 'कितनी देर बाद फिर याद दिलाऊं — 15 मिनट, 30 मिनट, या 1 घंटा?',
  tookConfirm: (name) => `${name} को लिया हुआ चिह्नित किया गया। शाबाश!`,
  skippedConfirm: (name) => `ठीक है, ${name} को आज के लिए छोड़ दिया गया है।`,
  postponedConfirm: (name, min) => `ठीक है, मैं ${min} मिनट बाद ${name} के बारे में फिर याद दिलाऊंगा।`,
  youSaid: 'आपने कहा:',
  tapToAnswer: 'जवाब देने के लिए टैप करें',
  listening: 'सुन रहा हूं… रोकने के लिए टैप करें',
  speaking: 'बोल रहा हूं…',
  anotherMedicine: 'किसी और दवा के बारे में पूछें',
};

const TE = {
  start: '🗣 ప్రారంభించండి — మందు గురించి అడగండి',
  subtitleGuided: 'ఏ మందు అని అడుగుతాను, తర్వాత మీరు ఏం చేయాలనుకుంటున్నారో',
  subtitleFreeform: 'ఏదైనా చెప్పండి, ఉదా. "నేను మందు తీసుకున్నాను"',
  askMedicine: (list) => `మీరు ఏ మందును అప్‌డేట్ చేయాలనుకుంటున్నారు? ${list} వంటి పేరు చెప్పవచ్చు.`,
  retryMedicine: 'క్షమించండి, అర్థం కాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి, లేదా క్రింద నొక్కండి.',
  gotItAskAction: (name) => `అలాగే — ${name}. మీరు దీన్ని తీసుకున్నారా, వదిలేశారా, లేదా గుర్తుచేయడం వాయిదా వేయాలా?`,
  retryAction: "క్షమించండి, దయచేసి 'తీసుకున్నాను', 'వదిలేశాను', లేదా 'వాయిదా' అని చెప్పండి — లేదా బటన్ నొక్కండి.",
  askDuration: 'ఎంతసేపు తర్వాత మళ్ళీ గుర్తు చేయాలి — 15 నిమిషాలు, 30 నిమిషాలు, లేదా 1 గంట?',
  tookConfirm: (name) => `${name} తీసుకున్నట్లు గుర్తించబడింది. బాగా చేశారు!`,
  skippedConfirm: (name) => `సరే, ${name} ఈరోజుకు వదిలేసినట్లు గుర్తించబడింది.`,
  postponedConfirm: (name, min) => `సరే, ${min} నిమిషాల తర్వాత ${name} గురించి మళ్ళీ గుర్తు చేస్తాను.`,
  youSaid: 'మీరు చెప్పింది:',
  tapToAnswer: 'సమాధానం ఇవ్వడానికి నొక్కండి',
  listening: 'వింటున్నాను… ఆపడానికి నొక్కండి',
  speaking: 'మాట్లాడుతున్నాను…',
  anotherMedicine: 'మరో మందు గురించి అడగండి',
};

const TA = {
  start: '🗣 தொடங்கு — மருந்தைப் பற்றி கேளுங்கள்',
  subtitleGuided: 'எந்த மருந்து என்று கேட்பேன், பிறகு நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்',
  subtitleFreeform: 'ஏதேனும் சொல்லுங்கள், எ.கா. "நான் மருந்து எடுத்துக்கொண்டேன்"',
  askMedicine: (list) => `நீங்கள் எந்த மருந்தை புதுப்பிக்க விரும்புகிறீர்கள்? ${list} போன்ற பெயரைச் சொல்லலாம்.`,
  retryMedicine: 'மன்னிக்கவும், புரியவில்லை. மீண்டும் முயற்சிக்கவும், அல்லது கீழே தட்டவும்.',
  gotItAskAction: (name) => `சரி — ${name}. நீங்கள் இதை எடுத்துக்கொண்டீர்களா, தவிர்த்தீர்களா, அல்லது நினைவூட்டலை ஒத்திவைக்கவா?`,
  retryAction: "மன்னிக்கவும், 'எடுத்துக்கொண்டேன்', 'தவிர்த்தேன்', அல்லது 'ஒத்திவை' என்று சொல்லுங்கள் — அல்லது பொத்தானைத் தட்டவும்.",
  askDuration: 'எவ்வளவு நேரம் கழித்து மீண்டும் நினைவூட்ட வேண்டும் — 15 நிமிடங்கள், 30 நிமிடங்கள், அல்லது 1 மணி நேரம்?',
  tookConfirm: (name) => `${name} எடுத்துக்கொண்டதாக குறிக்கப்பட்டது. அருமை!`,
  skippedConfirm: (name) => `சரி, ${name} இன்று தவிர்க்கப்பட்டதாக குறிக்கப்பட்டது.`,
  postponedConfirm: (name, min) => `சரி, ${min} நிமிடங்களில் ${name} பற்றி மீண்டும் நினைவூட்டுவேன்.`,
  youSaid: 'நீங்கள் சொன்னது:',
  tapToAnswer: 'பதிலளிக்க தட்டவும்',
  listening: 'கேட்கிறேன்… நிறுத்த தட்டவும்',
  speaking: 'பேசுகிறேன்…',
  anotherMedicine: 'வேறு மருந்தைப் பற்றி கேளுங்கள்',
};

const KN = {
  start: '🗣 ಪ್ರಾರಂಭಿಸಿ — ಔಷಧಿಯ ಬಗ್ಗೆ ಕೇಳಿ',
  subtitleGuided: 'ಯಾವ ಔಷಧಿ ಎಂದು ಕೇಳುತ್ತೇನೆ, ನಂತರ ನೀವು ಏನು ಮಾಡಬೇಕೆಂದು',
  subtitleFreeform: 'ಏನಾದರೂ ಹೇಳಿ, ಉದಾ. "ನಾನು ಔಷಧಿ ತೆಗೆದುಕೊಂಡೆ"',
  askMedicine: (list) => `ನೀವು ಯಾವ ಔಷಧಿಯನ್ನು ನವೀಕರಿಸಲು ಬಯಸುತ್ತೀರಿ? ${list} ನಂತಹ ಹೆಸರನ್ನು ಹೇಳಬಹುದು.`,
  retryMedicine: 'ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ.',
  gotItAskAction: (name) => `ಸರಿ — ${name}. ನೀವು ಇದನ್ನು ತೆಗೆದುಕೊಂಡಿರಾ, ಬಿಟ್ಟಿರಾ, ಅಥವಾ ಜ್ಞಾಪನೆಯನ್ನು ಮುಂದೂಡಬೇಕೆ?`,
  retryAction: "ಕ್ಷಮಿಸಿ, ದಯವಿಟ್ಟು 'ತೆಗೆದುಕೊಂಡೆ', 'ಬಿಟ್ಟೆ', ಅಥವಾ 'ಮುಂದೂಡು' ಎಂದು ಹೇಳಿ — ಅಥವಾ ಬಟನ್ ಒತ್ತಿ.",
  askDuration: 'ಎಷ್ಟು ಹೊತ್ತಿನ ನಂತರ ಮತ್ತೆ ನೆನಪಿಸಬೇಕು — 15 ನಿಮಿಷ, 30 ನಿಮಿಷ, ಅಥವಾ 1 ಗಂಟೆ?',
  tookConfirm: (name) => `${name} ತೆಗೆದುಕೊಂಡಂತೆ ಗುರುತಿಸಲಾಗಿದೆ. ಚೆನ್ನಾಗಿದೆ!`,
  skippedConfirm: (name) => `ಸರಿ, ${name} ಇಂದಿಗೆ ಬಿಟ್ಟಂತೆ ಗುರುತಿಸಲಾಗಿದೆ.`,
  postponedConfirm: (name, min) => `ಸರಿ, ${min} ನಿಮಿಷಗಳ ನಂತರ ${name} ಬಗ್ಗೆ ಮತ್ತೆ ನೆನಪಿಸುತ್ತೇನೆ.`,
  youSaid: 'ನೀವು ಹೇಳಿದ್ದು:',
  tapToAnswer: 'ಉತ್ತರಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
  listening: 'ಕೇಳುತ್ತಿದ್ದೇನೆ… ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
  speaking: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ…',
  anotherMedicine: 'ಇನ್ನೊಂದು ಔಷಧಿಯ ಬಗ್ಗೆ ಕೇಳಿ',
};

const ML = {
  start: '🗣 ആരംഭിക്കുക — മരുന്നിനെക്കുറിച്ച് ചോദിക്കുക',
  subtitleGuided: 'ഏത് മരുന്ന് എന്ന് ചോദിക്കും, പിന്നെ നിങ്ങൾക്ക് എന്ത് ചെയ്യണം',
  subtitleFreeform: 'എന്തും പറയൂ, ഉദാ. "ഞാൻ മരുന്ന് കഴിച്ചു"',
  askMedicine: (list) => `നിങ്ങൾ ഏത് മരുന്ന് അപ്ഡേറ്റ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നു? ${list} പോലുള്ള പേര് പറയാം.`,
  retryMedicine: 'ക്ഷമിക്കണം, മനസ്സിലായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ താഴെ ടാപ്പ് ചെയ്യുക.',
  gotItAskAction: (name) => `ശരി — ${name}. നിങ്ങൾ ഇത് കഴിച്ചോ, ഒഴിവാക്കിയോ, അതോ ഓർമ്മപ്പെടുത്തൽ മാറ്റിവയ്ക്കണോ?`,
  retryAction: "ക്ഷമിക്കണം, ദയവായി 'കഴിച്ചു', 'ഒഴിവാക്കി', അല്ലെങ്കിൽ 'മാറ്റിവയ്ക്കുക' എന്ന് പറയുക — അല്ലെങ്കിൽ ബട്ടൺ അമർത്തുക.",
  askDuration: 'എത്ര നേരം കഴിഞ്ഞ് വീണ്ടും ഓർമ്മിപ്പിക്കണം — 15 മിനിറ്റ്, 30 മിനിറ്റ്, അതോ 1 മണിക്കൂർ?',
  tookConfirm: (name) => `${name} കഴിച്ചതായി അടയാളപ്പെടുത്തി. നന്നായി!`,
  skippedConfirm: (name) => `ശരി, ${name} ഇന്നത്തേക്ക് ഒഴിവാക്കിയതായി അടയാളപ്പെടുത്തി.`,
  postponedConfirm: (name, min) => `ശരി, ${min} മിനിറ്റിനുള്ളിൽ ${name} നെക്കുറിച്ച് വീണ്ടും ഓർമ്മിപ്പിക്കാം.`,
  youSaid: 'നിങ്ങൾ പറഞ്ഞത്:',
  tapToAnswer: 'ഉത്തരം നൽകാൻ ടാപ്പ് ചെയ്യുക',
  listening: 'കേൾക്കുന്നു… നിർത്താൻ ടാപ്പ് ചെയ്യുക',
  speaking: 'സംസാരിക്കുന്നു…',
  anotherMedicine: 'മറ്റൊരു മരുന്നിനെക്കുറിച്ച് ചോദിക്കുക',
};

const MR = {
  start: '🗣 सुरू करा — औषधाबद्दल विचारा',
  subtitleGuided: 'कोणते औषध ते विचारेन, मग तुम्हाला काय करायचे आहे',
  subtitleFreeform: 'काहीही सांगा, उदा. "मी औषध घेतले"',
  askMedicine: (list) => `तुम्हाला कोणते औषध अपडेट करायचे आहे? तुम्ही ${list} सारखे नाव सांगू शकता.`,
  retryMedicine: 'माफ करा, समजले नाही. कृपया पुन्हा प्रयत्न करा, किंवा खाली टॅप करा.',
  gotItAskAction: (name) => `ठीक आहे — ${name}. तुम्ही हे घेतले, वगळले, की आठवण पुढे ढकलायची?`,
  retryAction: "माफ करा, कृपया 'घेतले', 'वगळले', किंवा 'पुढे ढकला' असे सांगा — किंवा खालील बटण दाबा.",
  askDuration: 'किती वेळाने पुन्हा आठवण करून द्यावी — 15 मिनिटे, 30 मिनिटे, की 1 तास?',
  tookConfirm: (name) => `${name} घेतले म्हणून चिन्हांकित केले. छान!`,
  skippedConfirm: (name) => `ठीक आहे, ${name} आजसाठी वगळले म्हणून चिन्हांकित केले.`,
  postponedConfirm: (name, min) => `ठीक आहे, ${min} मिनिटांनी ${name} बद्दल पुन्हा आठवण करून देईन.`,
  youSaid: 'तुम्ही म्हणालात:',
  tapToAnswer: 'उत्तर देण्यासाठी टॅप करा',
  listening: 'ऐकत आहे… थांबवण्यासाठी टॅप करा',
  speaking: 'बोलत आहे…',
  anotherMedicine: 'दुसऱ्या औषधाबद्दल विचारा',
};

const BN = {
  start: '🗣 শুরু করুন — ওষুধ সম্পর্কে জিজ্ঞাসা করুন',
  subtitleGuided: 'কোন ওষুধ জিজ্ঞাসা করব, তারপর আপনি কী করতে চান',
  subtitleFreeform: 'যেকোনো কিছু বলুন, যেমন "আমি ওষুধ খেয়েছি"',
  askMedicine: (list) => `আপনি কোন ওষুধ আপডেট করতে চান? আপনি ${list} এর মতো নাম বলতে পারেন।`,
  retryMedicine: 'দুঃখিত, বুঝতে পারিনি। আবার চেষ্টা করুন, বা নিচে ট্যাপ করুন।',
  gotItAskAction: (name) => `ঠিক আছে — ${name}। আপনি কি এটি খেয়েছেন, বাদ দিয়েছেন, নাকি স্মরণ করিয়ে দেওয়া স্থগিত করবেন?`,
  retryAction: "দুঃখিত, দয়া করে 'খেয়েছি', 'বাদ দিয়েছি', বা 'স্থগিত' বলুন — অথবা নিচের বোতাম চাপুন।",
  askDuration: 'কতক্ষণ পরে আবার মনে করিয়ে দেব — 15 মিনিট, 30 মিনিট, নাকি 1 ঘণ্টা?',
  tookConfirm: (name) => `${name} খাওয়া হয়েছে বলে চিহ্নিত করা হয়েছে। চমৎকার!`,
  skippedConfirm: (name) => `ঠিক আছে, ${name} আজকের জন্য বাদ দেওয়া হয়েছে বলে চিহ্নিত করা হয়েছে।`,
  postponedConfirm: (name, min) => `ঠিক আছে, ${min} মিনিটের মধ্যে ${name} সম্পর্কে আবার মনে করিয়ে দেব।`,
  youSaid: 'আপনি বলেছেন:',
  tapToAnswer: 'উত্তর দিতে ট্যাপ করুন',
  listening: 'শুনছি… থামাতে ট্যাপ করুন',
  speaking: 'বলছি…',
  anotherMedicine: 'অন্য ওষুধ সম্পর্কে জিজ্ঞাসা করুন',
};

const GU = {
  start: '🗣 શરૂ કરો — દવા વિશે પૂછો',
  subtitleGuided: 'હું કઈ દવા છે તે પૂછીશ, પછી તમારે શું કરવું છે',
  subtitleFreeform: 'કંઈપણ કહો, જેમ કે "મેં દવા લીધી"',
  askMedicine: (list) => `તમે કઈ દવા અપડેટ કરવા માંગો છો? તમે ${list} જેવું નામ કહી શકો છો.`,
  retryMedicine: 'માફ કરશો, સમજાયું નહીં. કૃપા કરી ફરી પ્રયાસ કરો, અથવા નીચે ટેપ કરો.',
  gotItAskAction: (name) => `ઠીક છે — ${name}. શું તમે આ લીધી, છોડી દીધી, કે યાદ અપાવવાનું મુલતવી રાખવું છે?`,
  retryAction: "માફ કરશો, કૃપા કરી 'લીધી', 'છોડી દીધી', અથવા 'મુલતવી' કહો — અથવા નીચેનું બટન દબાવો.",
  askDuration: 'કેટલા સમય પછી ફરી યાદ અપાવું — 15 મિનિટ, 30 મિનિટ, કે 1 કલાક?',
  tookConfirm: (name) => `${name} લીધી હોવાનું ચિહ્નિત કર્યું. સરસ!`,
  skippedConfirm: (name) => `ઠીક છે, ${name} આજ માટે છોડી દીધી હોવાનું ચિહ્નિત કર્યું.`,
  postponedConfirm: (name, min) => `ઠીક છે, ${min} મિનિટમાં ${name} વિશે ફરી યાદ અપાવીશ.`,
  youSaid: 'તમે કહ્યું:',
  tapToAnswer: 'જવાબ આપવા ટેપ કરો',
  listening: 'સાંભળી રહ્યો છું… રોકવા ટેપ કરો',
  speaking: 'બોલી રહ્યો છું…',
  anotherMedicine: 'બીજી દવા વિશે પૂછો',
};

const PA = {
  start: '🗣 ਸ਼ੁਰੂ ਕਰੋ — ਦਵਾਈ ਬਾਰੇ ਪੁੱਛੋ',
  subtitleGuided: 'ਮੈਂ ਪੁੱਛਾਂਗਾ ਕਿਹੜੀ ਦਵਾਈ, ਫਿਰ ਤੁਸੀਂ ਕੀ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ',
  subtitleFreeform: 'ਕੁਝ ਵੀ ਕਹੋ, ਜਿਵੇਂ "ਮੈਂ ਦਵਾਈ ਲੈ ਲਈ"',
  askMedicine: (list) => `ਤੁਸੀਂ ਕਿਹੜੀ ਦਵਾਈ ਅਪਡੇਟ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ? ਤੁਸੀਂ ${list} ਵਰਗਾ ਨਾਮ ਕਹਿ ਸਕਦੇ ਹੋ।`,
  retryMedicine: 'ਮਾਫ਼ ਕਰਨਾ, ਸਮਝ ਨਹੀਂ ਆਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਹੇਠਾਂ ਟੈਪ ਕਰੋ।',
  gotItAskAction: (name) => `ਠੀਕ ਹੈ — ${name}। ਕੀ ਤੁਸੀਂ ਇਹ ਲਈ, ਛੱਡੀ, ਜਾਂ ਯਾਦ ਦਹਾਨੀ ਮੁਲਤਵੀ ਕਰਨੀ ਹੈ?`,
  retryAction: "ਮਾਫ਼ ਕਰਨਾ, ਕਿਰਪਾ ਕਰਕੇ 'ਲੈ ਲਈ', 'ਛੱਡੀ', ਜਾਂ 'ਮੁਲਤਵੀ' ਕਹੋ — ਜਾਂ ਹੇਠਾਂ ਬਟਨ ਦਬਾਓ।",
  askDuration: 'ਕਿੰਨੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਯਾਦ ਦਿਵਾਵਾਂ — 15 ਮਿੰਟ, 30 ਮਿੰਟ, ਜਾਂ 1 ਘੰਟਾ?',
  tookConfirm: (name) => `${name} ਲਈ ਗਈ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ। ਸ਼ਾਬਾਸ਼!`,
  skippedConfirm: (name) => `ਠੀਕ ਹੈ, ${name} ਅੱਜ ਲਈ ਛੱਡੀ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ।`,
  postponedConfirm: (name, min) => `ਠੀਕ ਹੈ, ਮੈਂ ${min} ਮਿੰਟਾਂ ਬਾਅਦ ${name} ਬਾਰੇ ਫਿਰ ਯਾਦ ਦਿਵਾਵਾਂਗਾ।`,
  youSaid: 'ਤੁਸੀਂ ਕਿਹਾ:',
  tapToAnswer: 'ਜਵਾਬ ਦੇਣ ਲਈ ਟੈਪ ਕਰੋ',
  listening: 'ਸੁਣ ਰਿਹਾ ਹਾਂ… ਰੋਕਣ ਲਈ ਟੈਪ ਕਰੋ',
  speaking: 'ਬੋਲ ਰਿਹਾ ਹਾਂ…',
  anotherMedicine: 'ਕਿਸੇ ਹੋਰ ਦਵਾਈ ਬਾਰੇ ਪੁੱਛੋ',
};

const UR = {
  start: '🗣 شروع کریں — دوا کے بارے میں پوچھیں',
  subtitleGuided: 'میں پوچھوں گا کون سی دوا، پھر آپ کیا کرنا چاہتے ہیں',
  subtitleFreeform: 'کچھ بھی کہیں، جیسے "میں نے دوا لے لی"',
  askMedicine: (list) => `آپ کون سی دوا اپ ڈیٹ کرنا چاہتے ہیں؟ آپ ${list} جیسا نام کہہ سکتے ہیں۔`,
  retryMedicine: 'معذرت، سمجھ نہیں آیا۔ براہ کرم دوبارہ کوشش کریں، یا نیچے ٹیپ کریں۔',
  gotItAskAction: (name) => `ٹھیک ہے — ${name}۔ کیا آپ نے یہ لی، چھوڑ دی، یا یاد دہانی ملتوی کرنی ہے؟`,
  retryAction: "معذرت، براہ کرم 'لے لی'، 'چھوڑ دی'، یا 'ملتوی' کہیں — یا نیچے بٹن دبائیں۔",
  askDuration: 'کتنی دیر بعد دوبارہ یاد دلاؤں — 15 منٹ، 30 منٹ، یا 1 گھنٹہ؟',
  tookConfirm: (name) => `${name} لی گئی کے طور پر نشان زد۔ شاباش!`,
  skippedConfirm: (name) => `ٹھیک ہے، ${name} آج کے لیے چھوڑ دی گئی کے طور پر نشان زد۔`,
  postponedConfirm: (name, min) => `ٹھیک ہے، میں ${min} منٹ بعد ${name} کے بارے میں دوبارہ یاد دلاؤں گا۔`,
  youSaid: 'آپ نے کہا:',
  tapToAnswer: 'جواب دینے کے لیے ٹیپ کریں',
  listening: 'سن رہا ہوں… روکنے کے لیے ٹیپ کریں',
  speaking: 'بول رہا ہوں…',
  anotherMedicine: 'کسی اور دوا کے بارے میں پوچھیں',
};

const ES = {
  start: '🗣 Comenzar — Preguntar sobre un medicamento',
  subtitleGuided: 'Preguntaré qué medicamento, luego qué te gustaría hacer',
  subtitleFreeform: 'Di cualquier cosa, p. ej. "Tomé mi medicina"',
  askMedicine: (list) => `¿Qué medicamento te gustaría actualizar? Puedes decir un nombre como ${list}.`,
  retryMedicine: 'Lo siento, no entendí. Inténtalo de nuevo, o toca uno abajo.',
  gotItAskAction: (name) => `Entendido — ${name}. ¿Lo tomaste, lo omitiste, o quieres posponer el recordatorio?`,
  retryAction: "Lo siento, di 'lo tomé', 'lo omití', o 'posponer' — o toca un botón abajo.",
  askDuration: '¿Cuánto tiempo debo esperar antes de recordarte de nuevo — 15 minutos, 30 minutos, o 1 hora?',
  tookConfirm: (name) => `${name} marcado como tomado. ¡Bien hecho!`,
  skippedConfirm: (name) => `De acuerdo, ${name} se marcó como omitido por hoy.`,
  postponedConfirm: (name, min) => `De acuerdo, te recordaré sobre ${name} de nuevo en ${min} minutos.`,
  youSaid: 'Dijiste:',
  tapToAnswer: 'Toca para responder',
  listening: 'Escuchando… toca para detener',
  speaking: 'Hablando…',
  anotherMedicine: 'Preguntar sobre otro medicamento',
};

const FR = {
  start: '🗣 Démarrer — Demander à propos d\'un médicament',
  subtitleGuided: 'Je demanderai quel médicament, puis ce que vous voulez faire',
  subtitleFreeform: 'Dites n\'importe quoi, ex. "J\'ai pris mon médicament"',
  askMedicine: (list) => `Quel médicament souhaitez-vous mettre à jour ? Vous pouvez dire un nom comme ${list}.`,
  retryMedicine: 'Désolé, je n\'ai pas compris. Réessayez, ou touchez un ci-dessous.',
  gotItAskAction: (name) => `Compris — ${name}. L\'avez-vous pris, sauté, ou voulez-vous reporter le rappel ?`,
  retryAction: "Désolé, dites 'pris', 'sauté', ou 'reporter' — ou touchez un bouton ci-dessous.",
  askDuration: 'Combien de temps avant de vous rappeler à nouveau — 15 minutes, 30 minutes, ou 1 heure ?',
  tookConfirm: (name) => `${name} marqué comme pris. Bien joué !`,
  skippedConfirm: (name) => `D'accord, ${name} est marqué comme sauté pour aujourd'hui.`,
  postponedConfirm: (name, min) => `D'accord, je vous rappellerai à propos de ${name} dans ${min} minutes.`,
  youSaid: 'Vous avez dit :',
  tapToAnswer: 'Touchez pour répondre',
  listening: 'J\'écoute… touchez pour arrêter',
  speaking: 'Je parle…',
  anotherMedicine: 'Demander à propos d\'un autre médicament',
};

const AR = {
  start: '🗣 ابدأ — اسأل عن دواء',
  subtitleGuided: 'سأسأل عن الدواء، ثم ماذا تريد أن تفعل',
  subtitleFreeform: 'قل أي شيء، مثل "أخذت دوائي"',
  askMedicine: (list) => `ما هو الدواء الذي تريد تحديثه؟ يمكنك قول اسم مثل ${list}.`,
  retryMedicine: 'آسف، لم أفهم. حاول مرة أخرى، أو اضغط على واحد أدناه.',
  gotItAskAction: (name) => `حسنًا — ${name}. هل أخذته، تخطيته، أم تريد تأجيل التذكير؟`,
  retryAction: "آسف، من فضلك قل 'أخذت'، 'تخطيت'، أو 'أجل' — أو اضغط على زر أدناه.",
  askDuration: 'كم من الوقت يجب أن أنتظر قبل تذكيرك مرة أخرى — 15 دقيقة، 30 دقيقة، أم ساعة واحدة؟',
  tookConfirm: (name) => `تم تحديد ${name} كمأخوذ. أحسنت!`,
  skippedConfirm: (name) => `حسنًا، تم تحديد ${name} كمتخطى لهذا اليوم.`,
  postponedConfirm: (name, min) => `حسنًا، سأذكرك بشأن ${name} مرة أخرى بعد ${min} دقيقة.`,
  youSaid: 'قلت:',
  tapToAnswer: 'اضغط للإجابة',
  listening: 'أستمع… اضغط للتوقف',
  speaking: 'أتحدث…',
  anotherMedicine: 'اسأل عن دواء آخر',
};

const ZH = {
  start: '🗣 开始 — 询问药物',
  subtitleGuided: '我会先问是哪种药，然后问您想做什么',
  subtitleFreeform: '说任何话，例如"我吃了药"',
  askMedicine: (list) => `您想更新哪种药物？您可以说出名字，例如${list}。`,
  retryMedicine: '抱歉，没听清楚。请再试一次，或点击下方选项。',
  gotItAskAction: (name) => `好的 — ${name}。您是吃了、跳过了，还是要推迟提醒？`,
  retryAction: '抱歉，请说"吃了"、"跳过了"或"推迟" — 或点击下方按钮。',
  askDuration: '需要等多久再提醒您 — 15分钟、30分钟，还是1小时？',
  tookConfirm: (name) => `已将${name}标记为已服用。做得好！`,
  skippedConfirm: (name) => `好的，${name}今天已标记为跳过。`,
  postponedConfirm: (name, min) => `好的，我会在${min}分钟后再次提醒您服用${name}。`,
  youSaid: '您说：',
  tapToAnswer: '点击回答',
  listening: '正在聆听…点击停止',
  speaking: '正在说话…',
  anotherMedicine: '询问另一种药物',
};

const PT = {
  start: '🗣 Começar — Perguntar sobre um medicamento',
  subtitleGuided: 'Vou perguntar qual medicamento, depois o que você gostaria de fazer',
  subtitleFreeform: 'Diga qualquer coisa, ex. "Tomei meu remédio"',
  askMedicine: (list) => `Qual medicamento você gostaria de atualizar? Você pode dizer um nome como ${list}.`,
  retryMedicine: 'Desculpe, não entendi. Tente novamente, ou toque em um abaixo.',
  gotItAskAction: (name) => `Entendi — ${name}. Você tomou, pulou, ou quer adiar o lembrete?`,
  retryAction: "Desculpe, diga 'tomei', 'pulei', ou 'adiar' — ou toque em um botão abaixo.",
  askDuration: 'Quanto tempo devo esperar antes de lembrá-lo novamente — 15 minutos, 30 minutos, ou 1 hora?',
  tookConfirm: (name) => `${name} marcado como tomado. Muito bem!`,
  skippedConfirm: (name) => `Certo, ${name} foi marcado como pulado por hoje.`,
  postponedConfirm: (name, min) => `Certo, vou lembrá-lo sobre ${name} novamente em ${min} minutos.`,
  youSaid: 'Você disse:',
  tapToAnswer: 'Toque para responder',
  listening: 'Ouvindo… toque para parar',
  speaking: 'Falando…',
  anotherMedicine: 'Perguntar sobre outro medicamento',
};

const PROMPTS = {
  'en-US': EN, 'hi-IN': HI, 'te-IN': TE, 'ta-IN': TA, 'kn-IN': KN, 'ml-IN': ML,
  'mr-IN': MR, 'bn-IN': BN, 'gu-IN': GU, 'pa-IN': PA, 'ur-IN': UR,
  'es-ES': ES, 'fr-FR': FR, 'ar-SA': AR, 'zh-CN': ZH, 'pt-BR': PT,
};

// Convenience getter — always returns a complete prompt set, falling back
// field-by-field to English so a partial translation never breaks the flow.
export function getPrompts(langCode) {
  const custom = PROMPTS[langCode] || {};
  return { ...EN, ...custom };
}

export function matchActionWordLocalized(text, langCode) {
  const rules = ACTIONS[langCode] || ACTIONS['en-US'];
  if (rules.skip.test(text)) return 'skip';
  if (rules.postpone.test(text)) return 'postpone';
  if (rules.take.test(text)) return 'take';
  // Fall back to the English patterns too — recognizers sometimes
  // transliterate regional speech into Latin script unexpectedly.
  if (langCode !== 'en-US') {
    if (ACTIONS['en-US'].skip.test(text)) return 'skip';
    if (ACTIONS['en-US'].postpone.test(text)) return 'postpone';
    if (ACTIONS['en-US'].take.test(text)) return 'take';
  }
  return null;
}
