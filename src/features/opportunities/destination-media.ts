export type DestinationMedia = {
  src: string;
  alt: string;
  source: string;
  licence: string;
  attribution: string;
};

const media: Array<{ terms: string[]; value: DestinationMedia }> = [
  {
    terms: ["beijing", "china"],
    value: {
      src: "/images/destinations/beijing-tiananmen.jpg",
      alt: "Tiananmen Gate in Beijing, China",
      source: "Wikimedia Commons",
      licence: "CC BY 2.0",
      attribution: "Xiquinho Silva / Wikimedia Commons / CC BY 2.0",
    },
  },
  {
    terms: ["berlin", "germany"],
    value: {
      src: "/images/destinations/berlin-brandenburg-gate.jpg",
      alt: "Brandenburg Gate in Berlin, Germany",
      source: "Wikimedia Commons",
      licence: "CC BY 4.0",
      attribution: "Pierre-Selim Huard / Wikimedia Commons / CC BY 4.0",
    },
  },
  {
    terms: ["toronto", "ontario", "canada"],
    value: {
      src: "/images/destinations/toronto-skyline.jpg",
      alt: "Toronto skyline in Ontario, Canada",
      source: "Wikimedia Commons",
      licence: "CC0",
      attribution: "Peter Glyn / Wikimedia Commons / CC0",
    },
  },
  {
    terms: ["amsterdam", "netherlands", "nl"],
    value: {
      src: "/images/destinations/amsterdam-skyline.jpg",
      alt: "Amsterdam cityscape in the Netherlands",
      source: "Wikimedia Commons",
      licence: "CC0",
      attribution: "pxhere photo / Wikimedia Commons / CC0",
    },
  },
];

export function destinationMediaFor(destination: string | null | undefined): DestinationMedia | null {
  const normalized = (destination ?? "").trim().toLocaleLowerCase();
  return media.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.value ?? null;
}

export function validateDestinationImageUrl(value: string) {
  if (value.startsWith("/images/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["commons.wikimedia.org"].includes(url.hostname);
  } catch {
    return false;
  }
}
