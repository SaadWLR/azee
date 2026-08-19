/*
 * Corporate identity, offices and regulatory standing, as published by
 * AZEE Securities on azeetrade.com.
 *
 * Every value here is transcribed from the company's own site — no
 * figure, address, phone number or licence reference is inferred,
 * reformatted into a different meaning, or filled in from elsewhere.
 * Where the source prints two numbers for one office, both are kept;
 * where it prints none of a given kind, the field is simply absent.
 *
 * One typed registry rather than copy in N components, matching
 * src/data/legal.ts and src/data/knowledge.ts.
 *
 * NOT ported, deliberately: the "Beware of Fraudulent Activities"
 * warning that appears on the source site. It was removed site-wide by
 * an earlier decision and must stay removed — do not reintroduce it
 * here or on any page built from this file.
 */

export interface Office {
  /** Display name, e.g. "Registered Office". */
  name: string;
  /** Full street address, as published. */
  address: string;
  /** Every telephone number the source lists for this office. */
  tel: string[];
  fax?: string;
  email: string;
  /** City, for grouping the branch list. */
  city: string;
}

/** The two head offices. */
export const HEAD_OFFICES: Office[] = [
  {
    name: "Registered Office",
    address:
      "Room # 33, Ground Floor, Pakistan Stock Exchange, Stock Exchange Road, Karachi – 74000, Pakistan",
    tel: ["0309-2474783"],
    fax: "021-32477622",
    email: "info@azeetrade.com",
    city: "Karachi",
  },
  {
    name: "Corporate Office",
    address:
      "Suite # 705, 7th Floor, Business & Finance Centre, Main I.I. Chundrigar Road, Karachi, Pakistan",
    tel: ["021-33327747", "0309-2474783"],
    fax: "021-32477622",
    email: "info@azeetrade.com",
    city: "Karachi",
  },
];

/** The six branch offices, in the order the source lists them. */
export const BRANCHES: Office[] = [
  {
    name: "Gulshan-e-Iqbal Branch",
    address: "Room 404, 4th Floor, Trade Center, Block 13/A, Karachi",
    tel: ["021-34802390-4", "0300-7007002"],
    fax: "021-34972962",
    email: "info@azeetrade.com",
    city: "Karachi",
  },
  {
    name: "Clifton Branch",
    address:
      "Room # 1, Mezzanine Floor, Hamilton Court, Teen Talwar, Clifton, Karachi",
    tel: ["0300-9236878", "0312-2643113"],
    fax: "021-35831614",
    email: "info@azeetrade.com",
    city: "Karachi",
  },
  {
    name: "North Nazimabad Branch",
    address: "D-14, Block H, North Nazimabad, Karachi",
    tel: ["0333-2127645"],
    fax: "021-35831614",
    email: "info@azeetrade.com",
    city: "Karachi",
  },
  {
    name: "Malir Cantt Branch",
    address: "S-29, Cantt Bazar, 1st Floor, Malir Cantt, Karachi",
    tel: ["0321-2400834", "0333-2127842"],
    fax: "021-35831614",
    email: "info@azeetrade.com",
    city: "Karachi",
  },
  {
    name: "Lahore Branch",
    address:
      "Office # 226, 2nd Floor, Siddique Trade Center, Main Boulevard, Lahore",
    tel: ["0316-2133703"],
    fax: "0423-5787606",
    email: "info@azeetrade.com",
    city: "Lahore",
  },
  {
    name: "Rawalpindi Branch",
    address:
      "Building No. 54-C 54-B, 2nd Floor, Haider Road, Saddar, Rawalpindi Cantt",
    tel: ["051-5566593-7"],
    fax: "0423-5787606",
    email: "info@azeetrade.com",
    city: "Rawalpindi",
  },
];

/**
 * Headline contact channels, as published on the source's contact page.
 *
 * NOTE ON THE HELPLINE NUMBER: src/components/Footer.tsx carries
 * "+92 111-293-293" (and src/services/companyService.ts the same). That
 * short code does appear on the source's HOMEPAGE, but the contact page
 * — the page that exists to state how to reach the firm — lists only
 * the UAN below, for every channel. The two have not been reconciled
 * with the company, so this file states only what the contact page
 * states and the Footer is left untouched. See the milestone report.
 */
export const CONTACT = {
  uan: "+92-309 2474783",
  /** Tel: href form of the UAN. */
  uanHref: "tel:+923092474783",
  whatsapp: "+92 309 2474783",
  generalEmail: "info@azeetrade.com",
  supportEmail: "support@azeetrade.com",
  hours: "Monday to Friday · 9:00 AM – 5:30 PM",
} as const;

/** Registration, licensing and exchange/participant identifiers. */
export const REGULATORY: { term: string; value: string }[] = [
  { term: "Incorporated", value: "2003" },
  { term: "Company Registration No.", value: "K-8159 (2000-1)" },
  {
    term: "Securities Broker Licence",
    value: "108/Securities Broker/2019",
  },
  { term: "PSX TREC Holder No.", value: "108" },
  { term: "SECP Registration No.", value: "0041920" },
  { term: "CDC Participant ID", value: "04184" },
  { term: "NCCPL Participant Code", value: "C0418401" },
];

/**
 * Exchange memberships and participant relationships, as listed under
 * the source's "Membership & Participant Member" heading.
 */
export const MEMBERSHIPS: string[] = [
  "Regulated by the Securities and Exchange Commission of Pakistan",
  "Pakistan Stock Exchange (TREC Holder No. 108)",
  "Pakistan Mercantile Exchange Ltd",
  "Dubai Gold and Commodities Exchange",
  "Participant Broker of the Central Depository Company of Pakistan",
  "Participant Broker of the National Clearing Company of Pakistan Limited",
];

/**
 * The company's own account of itself. Transcribed from the source's
 * About page; nothing is summarised, re-worded or extended.
 */
export const ABOUT_PARAGRAPHS: string[] = [
  "Incorporated in 2003 (Registration No. K-8159 (2000-1)), AZEE Securities is a licensed securities broker, authorised by the Securities and Exchange Commission of Pakistan under Section 68 of the Securities Act, 2015 and Section 51 of the Futures Market Act, 2016 (Licence No. 108/Securities Broker/2019).",
  "Over the years, we have grown into one of Pakistan's leading retail brokerage houses, offering a wide range of investment products including Equities, IPOs, Commodities, Mutual Funds, and other capital market instruments.",
  "Our growth is rooted in a strong commitment to trust, transparency, and client-focused service. By embracing innovation and digital transformation, AZEE Securities now delivers seamless, tech-driven investment solutions tailored for today's investors.",
  "We remain dedicated to empowering clients with real-time market insights, expert guidance, and efficient trade execution — helping them secure a stronger financial future.",
];

/** The company's published vision statement. */
export const VISION_PARAGRAPHS: string[] = [
  "At AZEE Securities, our vision is to offer profitable wealth management services while uncovering new and promising financial avenues for our clients — all at accessible and affordable prices. We aim to make trading more inclusive, transparent, and understandable, breaking the long-held myths and hesitations surrounding the stock market, especially among non-traders.",
  "We are dedicated to fostering organic growth and long-term success for our clients — whether individuals or businesses. AZEE Securities is poised to become a one-stop tech-driven financial partner, providing smart, strategic solutions that can significantly transform our clients' financial journeys.",
];

/**
 * The Director's Message, by the company's founder. Reproduced as
 * published — this is his statement, not a paraphrase of it, and it
 * must not be rewritten to suit a layout.
 */
export const DIRECTORS_MESSAGE = {
  name: "Mr. Amir Zia",
  role: "Founder and CEO, AZEE Securities",
  paragraphs: [
    "The motivation behind founding AZEE Securities stemmed from a critical need for ethics and transparency in the financial industry. Observing the challenges faced by investors and the lack of trust in existing firms, I was inspired to create a brokerage that would set new standards.",
    "At AZEE Securities, we are committed to building a firm that not only prioritises transparency but also leverages cutting-edge technology to enhance the trading experience. Our focus is on providing exceptional customer service and ensuring that our clients have the tools and knowledge they need to make informed investment decisions.",
    "Our vision is to empower every individual in Pakistan to confidently navigate the complexities of the stock market and achieve their financial goals. Today, AZEE Securities stands as a trusted name in stock broking and wealth management, dedicated to fostering a culture of integrity and innovation.",
    "Together, we aim to redefine the investment landscape in Pakistan, making it more accessible, trustworthy, and efficient for all. Thank you for being a part of our journey.",
  ],
} as const;
