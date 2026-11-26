// Every video on the confirmation page, in page order, for the Pre-call engagement view.
// id = vturb player id or YouTube video id (as found on the page).
export const SECTIONS = [
  { key: 'main', title: 'Main video' },
  { key: 'faq', title: 'FAQs' },
  { key: 'deals', title: 'Deal breakdowns & student results' },
];

export const VIDEOS = [
  { id: '6a3f3149641d860e23c334c5', section: 'main', title: 'Main video (top of the page)' },

  { id: '6aa30c94804e51b2252ab6a6', section: 'faq', title: "What Is The Investor's Blueprint?" },
  { id: '6a6081cdc7784ebc62d3db2f', section: 'faq', title: 'Our Process' },
  { id: '6a3f30efaa3aacde342ae2bd', section: 'faq', title: 'Who Is Adriel And What Kind Of Deals Have You Done?' },
  { id: '6a3f2f6f641d860e23c3340d', section: 'faq', title: 'How Am I Different From Every Other Mentor?' },
  { id: '6a3f30a0641d860e23c33473', section: 'faq', title: 'Will You Help Me Find Deals?' },
  { id: '6a3f315d8db7a188639129cc', section: 'faq', title: 'Will You Help Me Avoid Getting Burned By Contractors?' },
  { id: '6a3f30768cf599a36e42fe75', section: 'faq', title: 'Does It Work For Beginners With No Development Experience?' },
  { id: '6aa31224682565b6dba4420f', section: 'faq', title: 'Can I Learn From YouTube?' },
  { id: '6aa3103facd68fca651ac3bf', section: 'faq', title: 'Do You Offer Refunds?' },
  { id: '6aa31381682565b6dba443a2', section: 'faq', title: 'How Much Capital Do I Need?' },
  { id: '6aa30c0032f15819ee1ef091', section: 'faq', title: 'What Can I Expect?' },
  { id: '6aa30dd7434c2f17aeac594b', section: 'faq', title: 'Who Is This For?' },
  { id: '6aa30f7b32f15819ee1ef371', section: 'faq', title: 'Who Is This Mentorship NOT For?' },
  { id: '6aa30e73c54492aa953da0e5', section: 'faq', title: 'Will I Talk To Adriel Directly?' },
  { id: '6aa3620271296a55130e8fda', section: 'faq', title: 'How Much Money Will I Save If I Join?' },
  { id: '6aa364593c93a6112424376c', section: 'faq', title: 'What Price Per Sq Ft Can You Build At?' },

  { id: '6aa992ed3f807c490701db8d', section: 'deals', title: 'Student Duplex' },
  { id: 'ITQNG3Hh2qw', section: 'deals', title: '3502 Noah' },
  { id: '_su9t7D6aJA', section: 'deals', title: 'Saphira Apartments' },
  { id: 'izMLta5AVXc', section: 'deals', title: '2011 Greg' },
  { id: 'f7VKz68vqi0', section: 'deals', title: '3411 Yellowstone' },
  { id: '6af8bf5ea49ed5c866e250aa', section: 'deals', title: 'Four-Home Lot (shovel-ready)' },
  { id: '8VpDFEcKOKw', section: 'deals', title: 'Montgomery Luxury Specs' },
];

export const VIDEO_IDS = new Set(VIDEOS.map((v) => v.id));
