/* HandPicked Editorial - pk-cities.js
   City list for the COD form datalist (mirrors the COD app's CITY_LIST) plus delivery-tier helpers.
   Tier 1 = Karachi, Lahore, Islamabad, Rawalpindi (2-4 working days); everything else is tier 2 (4-7). */
(function () {
  'use strict';
  var HP = (window.HP = window.HP || {});
  if (HP.pkCities) return;
  var cities = [
  "Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta",
  "Hyderabad","Gujranwala","Sialkot","Bahawalpur","Sargodha","Sukkur","Larkana","Sheikhupura",
  "Mardan","Gujrat","Kasur","Rahim Yar Khan","Sahiwal","Okara","Wah Cantt","Dera Ghazi Khan",
  "Mirpur Khas","Nawabshah","Mingora","Chiniot","Kamoke","Hafizabad","Sadiqabad","Burewala",
  "Kohat","Khanewal","Dera Ismail Khan","Turbat","Muzaffargarh","Abbottabad","Mandi Bahauddin","Shikarpur",
  "Jacobabad","Jhang","Khanpur","Gojra","Bahawalnagar","Muridke","Pakpattan","Tando Allahyar",
  "Tando Adam","Tando Muhammad Khan","Jaranwala","Chishtian","Daska","Mianwali","Ahmadpur East","Kamalia",
  "Khuzdar","Vihari","Mansehra","Jhelum","Attock","Chakwal","Haripur","Swabi",
  "Nowshera","Charsadda","Muzaffarabad","Mirpur","Kotli","Bagh","Rawalakot","Gilgit",
  "Skardu","Hunza","Chitral","Gwadar","Hub","Taxila","Murree","Sambrial",
  "Wazirabad","Narowal","Lodhran","Layyah","Rajanpur","Toba Tek Singh","Mianchannu","Arifwala",
  "Hasilpur","Bhakkar","Khushab","Jauharabad","Pindi Bhattian","Sangla Hill","Shorkot","Samundri",
  "Nankana Sahib","Kharian","Lala Musa","Mandi Faizabad","Rohri","Ghotki","Dadu","Jamshoro",
  "Thatta","Badin","Sanghar","Umerkot","Mithi","Kandhkot","Kashmore","Khairpur",
  "Matiari","Hala","Shahdadkot","Bannu","Lakki Marwat","Tank","Karak","Hangu",
  "Batkhela","Timergara","Dir","Buner","Shangla","Besham","Balakot","Havelian",
  "Tarbela","Mohmand","Khyber","Parachinar","Zhob","Sibi","Loralai","Chaman",
  "Pishin","Kalat","Mastung","Nushki","Panjgur","Dera Murad Jamali","Usta Muhammad","Jaffarabad",
  "Ghizer","Diamer","Ghanche","Astore","Neelum","Sudhnoti","Bhimber","Haveli",
  "Kallar Syedan","Gujar Khan","Sohawa","Fateh Jang","Hassan Abdal","Rawat","Chakri","Bhalwal",
  "Sillanwali","Pasrur","Phalia","Malakwal","Ferozewala","Raiwind","Gwadar Port","Ormara",
  "Lasbela","Bela","Kech"
  ];
  var aliases = { khi: 'Karachi', lhr: 'Lahore', isb: 'Islamabad', isloo: 'Islamabad', pindi: 'Rawalpindi', rwp: 'Rawalpindi' };
  var tier1 = { karachi: 1, lahore: 1, islamabad: 1, rawalpindi: 1 };
  var index = {};
  cities.forEach(function (c) { index[c.toLowerCase()] = c; });
  HP.pkCities = cities;
  /* Returns { name, tier, known } for free text; tier 0 when empty. */
  HP.pkCityInfo = function (text) {
    var key = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return { name: '', tier: 0, known: false };
    var name = index[key] || aliases[key] || '';
    if (!name) return { name: String(text).trim(), tier: 2, known: false };
    return { name: name, tier: tier1[name.toLowerCase()] ? 1 : 2, known: true };
  };
})();
