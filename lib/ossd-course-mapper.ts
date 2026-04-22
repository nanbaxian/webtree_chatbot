type OssdCourseCandidate = {
  code: string
  title: string
  grade: 9 | 10 | 11 | 12
  stream: string
}

type OssdCourseMapping = {
  searchQuery: string
  candidates: OssdCourseCandidate[]
  status: 'mapped' | 'ambiguous' | 'clarify'
  promptHint: string
}

type StreamHint = 'academic' | 'applied' | 'university' | 'university_college' | 'college' | 'workplace' | 'open' | null

type CourseFamily = {
  name: string
  keywords: RegExp[]
  candidates: OssdCourseCandidate[]
  ambiguityHint?: string
  clarifyWhenGenericGrade3Or4?: boolean
}

const MATH_COURSES: OssdCourseCandidate[] = [
  { code: 'MPM1D', title: 'Principles of Mathematics', grade: 9, stream: 'Academic' },
  { code: 'MFM1P', title: 'Foundations of Mathematics', grade: 9, stream: 'Applied' },
  { code: 'MPM2D', title: 'Principles of Mathematics', grade: 10, stream: 'Academic' },
  { code: 'MFM2P', title: 'Foundations of Mathematics', grade: 10, stream: 'Applied' },
  { code: 'MCR3U', title: 'Functions', grade: 11, stream: 'University Preparation' },
  { code: 'MCF3M', title: 'Functions and Applications', grade: 11, stream: 'University/College Preparation' },
  { code: 'MBF3C', title: 'Foundations for College Mathematics', grade: 11, stream: 'College Preparation' },
  { code: 'MEL3E', title: 'Mathematics for Work and Everyday Life', grade: 11, stream: 'Workplace Preparation' },
  { code: 'MHF4U', title: 'Advanced Functions', grade: 12, stream: 'University Preparation' },
  { code: 'MCV4U', title: 'Calculus and Vectors', grade: 12, stream: 'University Preparation' },
  { code: 'MDM4U', title: 'Mathematics of Data Management', grade: 12, stream: 'University Preparation' },
  { code: 'MAP4C', title: 'Foundations for College Mathematics', grade: 12, stream: 'College Preparation' },
  { code: 'MCT4C', title: 'Mathematics for College Technology', grade: 12, stream: 'College Preparation' },
  { code: 'MEL4E', title: 'Mathematics for Work and Everyday Life', grade: 12, stream: 'Workplace Preparation' },
]

const ENGLISH_COURSES: OssdCourseCandidate[] = [
  { code: 'ENG1D', title: 'English', grade: 9, stream: 'Academic' },
  { code: 'ENG1P', title: 'English', grade: 9, stream: 'Applied' },
  { code: 'ENG1L', title: 'English', grade: 9, stream: 'LDCC' },
  { code: 'ENG2D', title: 'English', grade: 10, stream: 'Academic' },
  { code: 'ENG2P', title: 'English', grade: 10, stream: 'Applied' },
  { code: 'ENG2L', title: 'English', grade: 10, stream: 'LDCC' },
  { code: 'ENG3U', title: 'English', grade: 11, stream: 'University Preparation' },
  { code: 'ENG3C', title: 'English', grade: 11, stream: 'College Preparation' },
  { code: 'ENG3E', title: 'English', grade: 11, stream: 'Workplace Preparation' },
  { code: 'ENG4U', title: 'English', grade: 12, stream: 'University Preparation' },
  { code: 'ENG4C', title: 'English', grade: 12, stream: 'College Preparation' },
  { code: 'ENG4E', title: 'English', grade: 12, stream: 'Workplace Preparation' },
]

const ESL_ELD_COURSES: OssdCourseCandidate[] = [
  { code: 'ESLAO', title: 'ESL Level 1', grade: 9, stream: 'Open' },
  { code: 'ESLBO', title: 'ESL Level 2', grade: 10, stream: 'Open' },
  { code: 'ESLCO', title: 'ESL Level 3', grade: 11, stream: 'Open' },
  { code: 'ESLDO', title: 'ESL Level 4', grade: 12, stream: 'Open' },
  { code: 'ELDAO', title: 'ELD Level 1', grade: 9, stream: 'Open' },
  { code: 'ELDBO', title: 'ELD Level 2', grade: 10, stream: 'Open' },
  { code: 'ELDCO', title: 'ELD Level 3', grade: 11, stream: 'Open' },
  { code: 'ELDDO', title: 'ELD Level 4', grade: 12, stream: 'Open' },
]

const FSL_COURSES: OssdCourseCandidate[] = [
  { code: 'FSF1D', title: 'Core French', grade: 9, stream: 'Academic' },
  { code: 'FSF1P', title: 'Core French', grade: 9, stream: 'Applied' },
  { code: 'FSF1O', title: 'Core French', grade: 9, stream: 'Open' },
  { code: 'FSF2D', title: 'Core French', grade: 10, stream: 'Academic' },
  { code: 'FSF2P', title: 'Core French', grade: 10, stream: 'Applied' },
  { code: 'FSF2O', title: 'Core French', grade: 10, stream: 'Open' },
  { code: 'FSF3U', title: 'Core French', grade: 11, stream: 'University Preparation' },
  { code: 'FSF3O', title: 'Core French', grade: 11, stream: 'Open' },
  { code: 'FSF4U', title: 'Core French', grade: 12, stream: 'University Preparation' },
  { code: 'FSF4O', title: 'Core French', grade: 12, stream: 'Open' },
  { code: 'FEF1D', title: 'Extended French', grade: 9, stream: 'Academic' },
  { code: 'FEF2D', title: 'Extended French', grade: 10, stream: 'Academic' },
  { code: 'FEF3U', title: 'Extended French', grade: 11, stream: 'University Preparation' },
  { code: 'FEF4U', title: 'Extended French', grade: 12, stream: 'University Preparation' },
  { code: 'FIF1D', title: 'French Immersion', grade: 9, stream: 'Academic' },
  { code: 'FIF1P', title: 'French Immersion', grade: 9, stream: 'Applied' },
  { code: 'FIF2D', title: 'French Immersion', grade: 10, stream: 'Academic' },
  { code: 'FIF2P', title: 'French Immersion', grade: 10, stream: 'Applied' },
  { code: 'FIF3U', title: 'French Immersion', grade: 11, stream: 'University Preparation' },
  { code: 'FIF3O', title: 'French Immersion', grade: 11, stream: 'Open' },
  { code: 'FIF4U', title: 'French Immersion', grade: 12, stream: 'University Preparation' },
  { code: 'FIF4O', title: 'French Immersion', grade: 12, stream: 'Open' },
]

const SCIENCE_COURSES: OssdCourseCandidate[] = [
  { code: 'SNC1D', title: 'Science', grade: 9, stream: 'Academic' },
  { code: 'SNC1P', title: 'Science', grade: 9, stream: 'Applied' },
  { code: 'SNC2D', title: 'Science', grade: 10, stream: 'Academic' },
  { code: 'SNC2P', title: 'Science', grade: 10, stream: 'Applied' },
  { code: 'SBI3U', title: 'Biology', grade: 11, stream: 'University Preparation' },
  { code: 'SBI3C', title: 'Biology', grade: 11, stream: 'College Preparation' },
  { code: 'SCH3U', title: 'Chemistry', grade: 11, stream: 'University Preparation' },
  { code: 'SPH3U', title: 'Physics', grade: 11, stream: 'University Preparation' },
  { code: 'SVN3M', title: 'Environmental Science', grade: 11, stream: 'University/College Preparation' },
  { code: 'SVN3E', title: 'Environmental Science', grade: 11, stream: 'Workplace Preparation' },
  { code: 'SBI4U', title: 'Biology', grade: 12, stream: 'University Preparation' },
  { code: 'SCH4U', title: 'Chemistry', grade: 12, stream: 'University Preparation' },
  { code: 'SCH4C', title: 'Chemistry', grade: 12, stream: 'College Preparation' },
  { code: 'SPH4U', title: 'Physics', grade: 12, stream: 'University Preparation' },
  { code: 'SPH4C', title: 'Physics', grade: 12, stream: 'College Preparation' },
  { code: 'SES4U', title: 'Earth and Space Science', grade: 12, stream: 'University Preparation' },
  { code: 'SNC4M', title: 'Science', grade: 12, stream: 'University/College Preparation' },
  { code: 'SNC4E', title: 'Science', grade: 12, stream: 'Workplace Preparation' },
]

const BUSINESS_COURSES: OssdCourseCandidate[] = [
  { code: 'BTT1O', title: 'Information and Communication Technology in Business', grade: 9, stream: 'Open' },
  { code: 'BBI1O', title: 'Introduction to Business', grade: 9, stream: 'Open' },
  { code: 'BTT2O', title: 'Information and Communication Technology in Business', grade: 10, stream: 'Open' },
  { code: 'BBI2O', title: 'Introduction to Business', grade: 10, stream: 'Open' },
  { code: 'BAF3M', title: 'Financial Accounting Fundamentals', grade: 11, stream: 'University/College Preparation' },
  { code: 'BAI3E', title: 'Accounting Essentials', grade: 11, stream: 'Workplace Preparation' },
  { code: 'BDI3C', title: 'Entrepreneurship: The Venture', grade: 11, stream: 'College Preparation' },
  { code: 'BDP3O', title: 'Entrepreneurship: The Enterprising Person', grade: 11, stream: 'Open' },
  { code: 'BTA3O', title: 'Information and Communication Technology: The Digital Environment', grade: 11, stream: 'Open' },
  { code: 'BMI3C', title: 'Marketing: Goods, Services, Events', grade: 11, stream: 'College Preparation' },
  { code: 'BMX3E', title: 'Marketing: Retail and Services', grade: 11, stream: 'Workplace Preparation' },
  { code: 'BAT4M', title: 'Financial Accounting Principles', grade: 12, stream: 'University/College Preparation' },
  { code: 'BAN4E', title: 'Accounting for a Small Business', grade: 12, stream: 'Workplace Preparation' },
  { code: 'BDV4C', title: 'Entrepreneurship: Venture Planning in an Electronic Age', grade: 12, stream: 'College Preparation' },
  { code: 'BTX4C', title: 'Information and Communication Technology: Multimedia Solutions', grade: 12, stream: 'College Preparation' },
  { code: 'BTX4E', title: 'Information and Communication Technology in the Workplace', grade: 12, stream: 'Workplace Preparation' },
  { code: 'BBB4M', title: 'International Business Fundamentals', grade: 12, stream: 'University/College Preparation' },
  { code: 'BBB4E', title: 'International Business Essentials', grade: 12, stream: 'Workplace Preparation' },
  { code: 'BOH4M', title: 'Business Leadership: Management Fundamentals', grade: 12, stream: 'University/College Preparation' },
  { code: 'BOG4E', title: 'Business Leadership: Becoming a Manager', grade: 12, stream: 'Workplace Preparation' },
]

const COMPUTER_COURSES: OssdCourseCandidate[] = [
  { code: 'ICS2O', title: 'Introduction to Computer Studies', grade: 10, stream: 'Open' },
  { code: 'ICS3U', title: 'Introduction to Computer Science', grade: 11, stream: 'University Preparation' },
  { code: 'ICS3C', title: 'Introduction to Computer Programming', grade: 11, stream: 'College Preparation' },
  { code: 'ICS4U', title: 'Computer Science', grade: 12, stream: 'University Preparation' },
  { code: 'ICS4C', title: 'Computer Programming', grade: 12, stream: 'College Preparation' },
]

const CWS_COURSES: OssdCourseCandidate[] = [
  { code: 'CGC1D', title: 'Issues in Canadian Geography', grade: 9, stream: 'Academic' },
  { code: 'CGC1P', title: 'Issues in Canadian Geography', grade: 9, stream: 'Applied' },
  { code: 'CHC2D', title: 'Canadian History since World War I', grade: 10, stream: 'Academic' },
  { code: 'CHC2P', title: 'Canadian History since World War I', grade: 10, stream: 'Applied' },
  { code: 'CHV2O', title: 'Civics and Citizenship', grade: 10, stream: 'Open' },
  { code: 'CGG3O', title: 'Travel and Tourism: A Geographic Perspective', grade: 11, stream: 'Open' },
  { code: 'CGT3O', title: 'Introduction to Spatial Technologies', grade: 11, stream: 'Open' },
  { code: 'CHA3U', title: 'American History', grade: 11, stream: 'University Preparation' },
  { code: 'CGW4U', title: 'World Issues: A Geographic Analysis', grade: 12, stream: 'University Preparation' },
  { code: 'CGW4C', title: 'World Issues: A Geographic Analysis', grade: 12, stream: 'College Preparation' },
  { code: 'CGO4M', title: 'Spatial Technologies in Action', grade: 12, stream: 'University/College Preparation' },
  { code: 'CGR4M', title: 'Environmental and Resource Management', grade: 12, stream: 'University/College Preparation' },
  { code: 'CGR4E', title: 'Sustainable Management of Resources and the Environment', grade: 12, stream: 'Workplace Preparation' },
  { code: 'CGU4M', title: 'World Geography: Urban Patterns and Population Issues', grade: 12, stream: 'University/College Preparation' },
  { code: 'CLU3E', title: 'Understanding Canadian Law in Everyday Life', grade: 11, stream: 'Workplace Preparation' },
  { code: 'CLN4U', title: 'Canadian and International Law', grade: 12, stream: 'University Preparation' },
  { code: 'CLN4C', title: 'Legal Studies', grade: 12, stream: 'College Preparation' },
  { code: 'CIA4U', title: 'Analysing Current Economic Issues', grade: 12, stream: 'University Preparation' },
  { code: 'CHY4U', title: 'World History since the Fifteenth Century', grade: 12, stream: 'University Preparation' },
]

const SOCIAL_SCIENCES_COURSES: OssdCourseCandidate[] = [
  { code: 'HIF1O', title: 'Exploring Family Studies', grade: 9, stream: 'Open' },
  { code: 'HIF2O', title: 'Exploring Family Studies', grade: 10, stream: 'Open' },
  { code: 'HFC3M', title: 'Food and Culture', grade: 11, stream: 'University/College Preparation' },
  { code: 'HFC3E', title: 'Food and Culture', grade: 11, stream: 'Workplace Preparation' },
  { code: 'HFA4C', title: 'Nutrition and Health', grade: 12, stream: 'College Preparation' },
  { code: 'HFA4U', title: 'Nutrition and Health', grade: 12, stream: 'University Preparation' },
  { code: 'HFN1O', title: 'Food and Nutrition', grade: 9, stream: 'Open' },
  { code: 'HFN2O', title: 'Food and Nutrition', grade: 10, stream: 'Open' },
  { code: 'HFL4E', title: 'Healthy Eating for Living', grade: 12, stream: 'Workplace Preparation' },
  { code: 'HHD3O', title: 'Human Development and Family Studies', grade: 11, stream: 'Open' },
  { code: 'HHG4M', title: 'Human Growth and Development', grade: 12, stream: 'University/College Preparation' },
  { code: 'HHS4C', title: 'Individuals and Families in Canada', grade: 12, stream: 'College Preparation' },
  { code: 'HHS4U', title: 'Individuals and Families in Canada', grade: 12, stream: 'University Preparation' },
  { code: 'HPC3O', title: 'Parenting', grade: 11, stream: 'Open' },
  { code: 'HPD4C', title: 'Interpersonal Relationships', grade: 12, stream: 'College Preparation' },
  { code: 'HPW3C', title: 'Interpersonal and Family Relationships', grade: 11, stream: 'College Preparation' },
  { code: 'HIP4O', title: 'Managing Personal and Family Resources', grade: 12, stream: 'Open' },
  { code: 'HSP3U', title: 'Introduction to Anthropology, Psychology, and Sociology', grade: 11, stream: 'University Preparation' },
  { code: 'HSP3C', title: 'Introduction to Anthropology, Psychology, and Sociology', grade: 11, stream: 'College Preparation' },
  { code: 'HSB4U', title: 'Challenge and Change in Society', grade: 12, stream: 'University Preparation' },
  { code: 'HSE4M', title: 'Equity and Social Justice: From Theory to Practice', grade: 12, stream: 'University/College Preparation' },
  { code: 'HSC4M', title: 'World Cultures', grade: 12, stream: 'University/College Preparation' },
]

const HEALTH_COURSES: OssdCourseCandidate[] = [
  { code: 'PPL1O', title: 'Healthy Active Living Education', grade: 9, stream: 'Open' },
  { code: 'PPL2O', title: 'Healthy Active Living Education', grade: 10, stream: 'Open' },
  { code: 'PPL3O', title: 'Healthy Active Living Education', grade: 11, stream: 'Open' },
  { code: 'PPL4O', title: 'Healthy Active Living Education', grade: 12, stream: 'Open' },
  { code: 'PSK4U', title: 'Introductory Kinesiology', grade: 12, stream: 'University Preparation' },
]

const TECH_COURSES: OssdCourseCandidate[] = [
  { code: 'TIJ1O', title: 'Exploring Technologies', grade: 9, stream: 'Open' },
  { code: 'TGJ2O', title: 'Communications Technology', grade: 10, stream: 'Open' },
  { code: 'TEJ2O', title: 'Computer Technology', grade: 10, stream: 'Open' },
  { code: 'TCJ2O', title: 'Construction Technology', grade: 10, stream: 'Open' },
  { code: 'THJ2O', title: 'Green Industries', grade: 10, stream: 'Open' },
  { code: 'TXJ2O', title: 'Hairstyling and Aesthetics', grade: 10, stream: 'Open' },
  { code: 'TPJ2O', title: 'Health Care', grade: 10, stream: 'Open' },
  { code: 'TFJ2O', title: 'Hospitality and Tourism', grade: 10, stream: 'Open' },
  { code: 'TMJ2O', title: 'Manufacturing Technology', grade: 10, stream: 'Open' },
  { code: 'TDJ2O', title: 'Technological Design', grade: 10, stream: 'Open' },
  { code: 'TTJ2O', title: 'Transportation Technology', grade: 10, stream: 'Open' },
  { code: 'TDJ3M', title: 'Technological Design', grade: 11, stream: 'University/College Preparation' },
  { code: 'TDJ3O', title: 'Technological Design and the Environment', grade: 11, stream: 'Open' },
  { code: 'TDJ4M', title: 'Technological Design', grade: 12, stream: 'University/College Preparation' },
  { code: 'TDJ4O', title: 'Technological Design in the Twenty-first Century', grade: 12, stream: 'Open' },
  { code: 'TMJ3M', title: 'Manufacturing Engineering Technology', grade: 11, stream: 'University/College Preparation' },
  { code: 'TMJ3C', title: 'Manufacturing Technology', grade: 11, stream: 'College Preparation' },
  { code: 'TMJ3E', title: 'Manufacturing Technology', grade: 11, stream: 'Workplace Preparation' },
  { code: 'TMJ4M', title: 'Manufacturing Engineering Technology', grade: 12, stream: 'University/College Preparation' },
  { code: 'TMJ4C', title: 'Manufacturing Technology', grade: 12, stream: 'College Preparation' },
  { code: 'TMJ4E', title: 'Manufacturing Technology', grade: 12, stream: 'Workplace Preparation' },
  { code: 'TTJ3C', title: 'Transportation Technology', grade: 11, stream: 'College Preparation' },
  { code: 'TTJ3O', title: 'Transportation Technology: Vehicle Ownership', grade: 11, stream: 'Open' },
  { code: 'TTJ4C', title: 'Transportation Technology', grade: 12, stream: 'College Preparation' },
  { code: 'TTJ4E', title: 'Transportation Technology: Vehicle Maintenance', grade: 12, stream: 'Workplace Preparation' },
  { code: 'TDA3M', title: 'Technological Design: Architectural Design', grade: 11, stream: 'University/College Preparation' },
  { code: 'TDM3M', title: 'Technological Design: Mechanical and Industrial Design', grade: 11, stream: 'University/College Preparation' },
  { code: 'TDP3M', title: 'Technological Design: Apparel and Textile Design', grade: 11, stream: 'University/College Preparation' },
  { code: 'TDR3M', title: 'Technological Design: Robotics and Control Systems', grade: 11, stream: 'University/College Preparation' },
  { code: 'TDV3M', title: 'Technological Design: Interior Design', grade: 11, stream: 'University/College Preparation' },
  { code: 'TDA4M', title: 'Technological Design: Architectural Design', grade: 12, stream: 'University/College Preparation' },
  { code: 'TDM4M', title: 'Technological Design: Mechanical and Industrial Design', grade: 12, stream: 'University/College Preparation' },
  { code: 'TDP4M', title: 'Technological Design: Apparel and Textile Design', grade: 12, stream: 'University/College Preparation' },
  { code: 'TDR4M', title: 'Technological Design: Robotics and Control Systems', grade: 12, stream: 'University/College Preparation' },
  { code: 'TDV4M', title: 'Technological Design: Interior Design', grade: 12, stream: 'University/College Preparation' },
  { code: 'TFN3C', title: 'Hospitality and Tourism: Applied Nutrition', grade: 11, stream: 'College Preparation' },
  { code: 'TFR3C', title: 'Hospitality and Tourism: Culinary Arts and Management', grade: 11, stream: 'College Preparation' },
  { code: 'TFT3C', title: 'Hospitality and Tourism: Tourism and Travel Planning', grade: 11, stream: 'College Preparation' },
  { code: 'TFB3E', title: 'Hospitality and Tourism: Baking', grade: 11, stream: 'Workplace Preparation' },
  { code: 'TFC3E', title: 'Hospitality and Tourism: Cooking', grade: 11, stream: 'Workplace Preparation' },
  { code: 'TFE3E', title: 'Hospitality and Tourism: Event Planning', grade: 11, stream: 'Workplace Preparation' },
  { code: 'TFN4C', title: 'Hospitality and Tourism: Applied Nutrition', grade: 12, stream: 'College Preparation' },
  { code: 'TFR4C', title: 'Hospitality and Tourism: Culinary Arts and Management', grade: 12, stream: 'College Preparation' },
  { code: 'TFT4C', title: 'Hospitality and Tourism: Tourism and Travel Planning', grade: 12, stream: 'College Preparation' },
  { code: 'TFB4E', title: 'Hospitality and Tourism: Baking', grade: 12, stream: 'Workplace Preparation' },
  { code: 'TFC4E', title: 'Hospitality and Tourism: Cooking', grade: 12, stream: 'Workplace Preparation' },
  { code: 'TFE4E', title: 'Hospitality and Tourism: Event Planning', grade: 12, stream: 'Workplace Preparation' },
]

const ARTS_COURSES: OssdCourseCandidate[] = [
  { code: 'AVI1O', title: 'Visual Arts', grade: 9, stream: 'Open' },
  { code: 'AVI2O', title: 'Visual Arts', grade: 10, stream: 'Open' },
  { code: 'AVI3M', title: 'Visual Arts', grade: 11, stream: 'University/College Preparation' },
  { code: 'AVI4M', title: 'Visual Arts', grade: 12, stream: 'University/College Preparation' },
  { code: 'ADA1O', title: 'Drama', grade: 9, stream: 'Open' },
  { code: 'ADA2O', title: 'Drama', grade: 10, stream: 'Open' },
  { code: 'ADA3M', title: 'Drama', grade: 11, stream: 'University/College Preparation' },
  { code: 'ADA4M', title: 'Drama', grade: 12, stream: 'University/College Preparation' },
  { code: 'AMU1O', title: 'Music', grade: 9, stream: 'Open' },
  { code: 'AMU2O', title: 'Music', grade: 10, stream: 'Open' },
  { code: 'AMU3M', title: 'Music', grade: 11, stream: 'University/College Preparation' },
  { code: 'AMU4M', title: 'Music', grade: 12, stream: 'University/College Preparation' },
  { code: 'ASM3M', title: 'Media Arts', grade: 11, stream: 'University/College Preparation' },
  { code: 'ASM4M', title: 'Media Arts', grade: 12, stream: 'University/College Preparation' },
]

const GUIDANCE_COURSES: OssdCourseCandidate[] = [
  { code: 'GLC2O', title: 'Career Studies', grade: 10, stream: 'Open' },
  { code: 'GLS1O', title: 'Learning Strategies', grade: 9, stream: 'Open' },
  { code: 'GLS2O', title: 'Learning Strategies', grade: 10, stream: 'Open' },
  { code: 'GPP3O', title: 'Leadership and Peer Support', grade: 11, stream: 'Open' },
  { code: 'GWL3O', title: 'Creating Opportunities for Learning and Work', grade: 11, stream: 'Open' },
  { code: 'GWL4O', title: 'Creating Opportunities for Learning and Work', grade: 12, stream: 'Open' },
]

const COOP_COURSES: OssdCourseCandidate[] = [
  { code: 'DCO3O', title: 'Cooperative Education', grade: 11, stream: 'Open' },
  { code: 'DCO4O', title: 'Cooperative Education', grade: 12, stream: 'Open' },
]

const COURSE_FAMILIES: CourseFamily[] = [
  {
    name: 'Math',
    keywords: [/\b(math|mathematics|functions|advanced functions|calculus|vectors|data management|maths|数学|数学课|微积分|代数|函数)\b/],
    candidates: MATH_COURSES,
    ambiguityHint: 'Grade or stream may be needed for Ontario math courses.',
    clarifyWhenGenericGrade3Or4: true,
  },
  {
    name: 'English',
    keywords: [/\b(english|eng|writing|reading|literature|literacy|英语|英文|写作|阅读|文学)\b/],
    candidates: ENGLISH_COURSES,
    ambiguityHint: 'Grade or stream may be needed for Ontario English courses.',
    clarifyWhenGenericGrade3Or4: true,
  },
  {
    name: 'ESL/ELD',
    keywords: [/\b(esl|eld|english as a second language|english literacy development|英语作为第二语言|英语作为第二语言课程|英语语言发展)\b/],
    candidates: ESL_ELD_COURSES,
    ambiguityHint: 'ESL/ELD level usually needs a grade or level number.',
  },
  {
    name: 'French',
    keywords: [/\b(french|core french|extended french|french immersion|fsf|fef|fif|法语|核心法语|延伸法语|法语沉浸)\b/],
    candidates: FSL_COURSES,
    ambiguityHint: 'French programs often need the program type: core, extended, or immersion.',
  },
  {
    name: 'Science',
    keywords: [/\b(science|biology|chemistry|physics|environmental science|earth and space|科学|生物|化学|物理|环境科学|地球与宇宙科学)\b/],
    candidates: SCIENCE_COURSES,
    ambiguityHint: 'Ontario science often needs the specific strand, especially in Grade 11 and 12.',
    clarifyWhenGenericGrade3Or4: true,
  },
  {
    name: 'Business',
    keywords: [/\b(business|accounting|entrepreneurship|marketing|international business|leadership|commerce|ict in business|商科|商业|会计|创业|市场营销|国际商务|领导力)\b/],
    candidates: BUSINESS_COURSES,
    ambiguityHint: 'Business courses often need the stream: open, workplace, college, or university/college.',
  },
  {
    name: 'Computer',
    keywords: [/\b(computer science|computer programming|computer studies|programming|code|计算机|电脑|编程|程序设计|代码)\b/],
    candidates: COMPUTER_COURSES,
    ambiguityHint: 'Computer studies often need grade and stream to separate ICS3U, ICS3C, ICS4U, and ICS4C.',
  },
  {
    name: 'Canadian and World Studies',
    keywords: [/\b(geography|history|civics|law|world issues|spatial technologies|tourism|economics|politics|地理|历史|公民|法律|世界问题|旅游|经济|政治)\b/],
    candidates: CWS_COURSES,
    ambiguityHint: 'Canadian and World Studies often needs the specific branch: geography, history, civics, law, or economics.',
  },
  {
    name: 'Social Sciences and Humanities',
    keywords: [/\b(social science|social sciences|humanities|family studies|food and nutrition|parenting|anthropology|psychology|sociology|challenge and change|equity|world cultures|社会科学|人文|心理学|社会学|家庭研究|营养|育儿|公平|世界文化)\b/],
    candidates: SOCIAL_SCIENCES_COURSES,
    ambiguityHint: 'Social Sciences and Humanities often needs the subject branch: family studies, food and nutrition, or psychology/sociology.',
  },
  {
    name: 'Health and PE',
    keywords: [/\b(health|physical education|pe|healthy active living|kinesiology|fitness|健康|体育|体能|运动|运动科学)\b/],
    candidates: HEALTH_COURSES,
    ambiguityHint: 'Health and physical education often needs grade and whether the user means healthy active living or kinesiology.',
  },
  {
    name: 'Technological Education',
    keywords: [/\b(technology|technological|technological design|transportation|manufacturing|communications technology|construction|green industries|hairstyling|health care|hospitality|tourism|teched|技术|科技|技术设计|制造|运输|传媒技术|建筑|旅游与酒店)\b/],
    candidates: TECH_COURSES,
    ambiguityHint: 'Technological education often needs the specialization, like transportation, manufacturing, or hospitality and tourism.',
  },
  {
    name: 'Arts',
    keywords: [/\b(arts|art|visual arts|drama|music|media arts|dance|艺术|美术|视觉艺术|戏剧|音乐|媒体艺术|舞蹈)\b/],
    candidates: ARTS_COURSES,
    ambiguityHint: 'The arts usually need the discipline: visual arts, drama, music, or media arts.',
  },
  {
    name: 'Guidance and Career Education',
    keywords: [/\b(career studies|learning strategies|leadership and peer support|peer support|opportunities for learning and work|glc|gls|gpp|gwl|职业研究|学习策略|同伴支持|学习与工作机会)\b/],
    candidates: GUIDANCE_COURSES,
    ambiguityHint: 'Guidance and career education often needs the specific course, such as career studies, learning strategies, or creating opportunities for learning and work.',
  },
  {
    name: 'Co-op',
    keywords: [/\b(co[- ]?op|cooperative education|coop|实习|合作教育|带薪实习)\b/],
    candidates: COOP_COURSES,
    ambiguityHint: 'Co-op courses are usually open and need the credit year, such as Grade 11 or 12 cooperative education.',
  },
]

const EXACT_INDEX = new Map<string, OssdCourseCandidate>()
for (const course of COURSE_FAMILIES.flatMap(family => family.candidates)) {
  EXACT_INDEX.set(course.code, course)
}

function normalizeQuery(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

function detectGrade(query: string): 9 | 10 | 11 | 12 | null {
  if (/\b(9年级|初三|高一)\b/.test(query)) return 9
  if (/\b(10年级|高二)\b/.test(query)) return 10
  if (/\b(11年级|高三)\b/.test(query)) return 11
  if (/\b(12年级|高四)\b/.test(query)) return 12
  if (/\b(grade\s*9|g9|9th\s*grade|9\s*grade)\b/.test(query)) return 9
  if (/\b(grade\s*10|g10|10th\s*grade|10\s*grade)\b/.test(query)) return 10
  if (/\b(grade\s*11|g11|11th\s*grade|11\s*grade)\b/.test(query)) return 11
  if (/\b(grade\s*12|g12|12th\s*grade|12\s*grade)\b/.test(query)) return 12
  return null
}

function detectStream(query: string): StreamHint {
  if (/\b(大学预备|大学预科|u课|u课|university prep|uprep)\b/i.test(query)) return 'university'
  if (/\b(大学\/学院|u\/c|大学学院|混合|university and college)\b/i.test(query)) return 'university_college'
  if (/\b(学院预备|college prep|college preparation)\b/i.test(query)) return 'college'
  if (/\b(工作场所|职场|workplace)\b/i.test(query)) return 'workplace'
  if (/\b(开放|open)\b/i.test(query)) return 'open'
  if (/\b(university\/college|u\/c|university and college|mixed)\b/.test(query)) return 'university_college'
  if (/\b(university|academic|pre[- ]?u|preuniversity)\b/.test(query)) return 'university'
  if (/\b(college|pre[- ]?c|precollege)\b/.test(query)) return 'college'
  if (/\b(workplace|work|everyday life|life skills)\b/.test(query)) return 'workplace'
  if (/\b(applied)\b/.test(query)) return 'applied'
  if (/\b(open)\b/.test(query)) return 'open'
  return null
}

function formatCandidates(candidates: OssdCourseCandidate[]): string {
  return candidates
    .map(item => `${item.code} (${item.title}, ${item.stream})`)
    .join('; ')
}

function applyStreamFilter(candidates: OssdCourseCandidate[], stream: StreamHint): OssdCourseCandidate[] {
  if (!stream) return candidates

  return candidates.filter(candidate => {
    const label = candidate.stream.toLowerCase()
    if (stream === 'university_college') return label.includes('university/college')
    if (stream === 'university') return label.includes('university') || label.includes('academic')
    if (stream === 'college') return label.includes('college')
    if (stream === 'workplace') return label.includes('workplace')
    if (stream === 'applied') return label.includes('applied')
    if (stream === 'open') return label.includes('open')
    return true
  })
}

function buildMapping(
  query: string,
  candidates: OssdCourseCandidate[],
  status: OssdCourseMapping['status'],
  hint: string,
): OssdCourseMapping {
  const safeCandidates = candidates.length > 0 ? candidates : []
  const searchQuery = safeCandidates.length > 0
    ? `${query}\n\nOSSD course candidates: ${formatCandidates(safeCandidates)}`
    : query

  return {
    searchQuery,
    candidates: safeCandidates,
    status,
    promptHint: hint,
  }
}

function detectExactCode(query: string): OssdCourseCandidate | null {
  const matches = query.toUpperCase().match(/\b[A-Z]{3}[0-9][A-Z]\b/g) || []
  for (const code of matches) {
    const course = EXACT_INDEX.get(code)
    if (course) return course
  }
  return null
}

function familyMatches(family: CourseFamily, query: string): boolean {
  return family.keywords.some(pattern => pattern.test(query))
}

function filterByGradeAndStream(
  candidates: OssdCourseCandidate[],
  grade: 9 | 10 | 11 | 12 | null,
  stream: StreamHint,
): OssdCourseCandidate[] {
  const byGrade = candidates.filter(course => grade == null || course.grade === grade)
  return applyStreamFilter(byGrade, stream)
}

function mapFamily(
  family: CourseFamily,
  query: string,
  grade: 9 | 10 | 11 | 12 | null,
  stream: StreamHint,
): OssdCourseMapping {
  let candidates = filterByGradeAndStream(family.candidates, grade, stream)
  if (!candidates.length) {
    candidates = filterByGradeAndStream(family.candidates, grade, null)
  }

  if (!candidates.length) {
    return buildMapping(query, [], 'clarify', `No ${family.name} course code could be matched. Ask for grade and stream.`)
  }

  if (family.clarifyWhenGenericGrade3Or4 && (grade === 11 || grade === 12) && candidates.length > 1) {
    return buildMapping(
      query,
      candidates,
      'clarify',
      `In Ontario OSSD, ${family.name.toLowerCase()} in Grade ${grade} is often a family of courses. Possible matches: ${formatCandidates(candidates)}. Ask for the specific subject/stream before answering.`,
    )
  }

  const status: OssdCourseMapping['status'] = candidates.length === 1 ? 'mapped' : 'ambiguous'
  const hint = candidates.length === 1
    ? `Mapped OSSD ${family.name.toLowerCase()} course: ${formatCandidates(candidates)}.`
    : `Broad ${family.name} query detected. Possible courses: ${formatCandidates(candidates)}. ${family.ambiguityHint || 'Ask for a specific stream if the user did not provide one.'}`
  return buildMapping(query, candidates, status, hint)
}

function mapAnyOssdCourse(query: string): OssdCourseMapping | null {
  const normalized = normalizeQuery(query)
  const exact = detectExactCode(normalized)
  if (exact) {
    return buildMapping(
      query,
      [exact],
      'mapped',
      `Exact OSSD course code detected: ${exact.code} (${exact.title}, ${exact.stream}). Trust the code and answer using that course.`,
    )
  }

  if (/\bguidance\b/.test(normalized) && !/\b(career studies|learning strategies|leadership and peer support|peer support|opportunities for learning and work|glc|gls|gpp|gwl)\b/.test(normalized)) {
    return buildMapping(
      query,
      GUIDANCE_COURSES,
      'clarify',
      'Ontario OSSD does not have a single generic Grade 11 guidance course. Ask whether the user means career studies, learning strategies, leadership and peer support, or creating opportunities for learning and work.',
    )
  }

  const grade = detectGrade(normalized)
  const stream = detectStream(normalized)

  if (/\b(course code|course codes|代码|课号|课程代码|课程号)\b/i.test(normalized)) {
    const codeHints = normalized.match(/\b[a-z]{3}[0-9][a-z]\b/gi) || []
    if (codeHints.length > 0) {
      const matches = codeHints
        .map(code => EXACT_INDEX.get(code.toUpperCase()))
        .filter((course): course is OssdCourseCandidate => Boolean(course))
      if (matches.length > 0) {
        return buildMapping(
          query,
          matches,
          matches.length === 1 ? 'mapped' : 'ambiguous',
          `Course code lookup detected. Possible matches: ${formatCandidates(matches)}.`,
        )
      }
    }
  }

  for (const family of COURSE_FAMILIES) {
    if (familyMatches(family, normalized)) {
      return mapFamily(family, query, grade, stream)
    }
  }

  if (/\b(课程|course|科目|subject|自然语言|自然描述|家长会问|适合|想选)\b/i.test(normalized) || /[\u4e00-\u9fff]/.test(normalized)) {
    const hints: string[] = []
    if (/\b(数学|math)\b/i.test(normalized)) hints.push('math')
    if (/\b(英语|english)\b/i.test(normalized)) hints.push('english')
    if (/\b(生物|biology)\b/i.test(normalized)) hints.push('biology')
    if (/\b(化学|chemistry)\b/i.test(normalized)) hints.push('chemistry')
    if (/\b(物理|physics)\b/i.test(normalized)) hints.push('physics')
    if (/\b(计算机|电脑|coding|programming|computer)\b/i.test(normalized)) hints.push('computer science')
    if (/\b(商科|商业|business|accounting|marketing)\b/i.test(normalized)) hints.push('business')
    if (/\b(心理|psychology)\b/i.test(normalized)) hints.push('psychology')
    if (/\b(设计|art|visual|media)\b/i.test(normalized)) hints.push('arts and design')
    if (/\b(co[- ]?op|实习|合作教育)\b/i.test(normalized)) hints.push('co-op')
    if (/\b(大学预备|大学预科|u课|university)\b/i.test(normalized)) hints.push('university prep')
    if (/\b(学院预备|college)\b/i.test(normalized)) hints.push('college prep')

    if (hints.length > 0) {
      return buildMapping(
        query,
        [],
        'ambiguous',
        `Natural-language course query detected. Try these Ontario course families or codes in the search: ${[...new Set(hints)].join(', ')}. Ask for grade and stream if needed.`,
      )
    }
  }

  return null
}

export function expandOssdCourseQuery(query: string): OssdCourseMapping | null {
  return mapAnyOssdCourse(query)
}

export function expandOssdMathQuery(query: string): OssdCourseMapping | null {
  const normalized = normalizeQuery(query)
  if (!/\b(math|mathematics)\b/.test(normalized)) return null
  const grade = detectGrade(normalized)
  const stream = detectStream(normalized)
  return mapFamily(COURSE_FAMILIES[0], query, grade, stream)
}
