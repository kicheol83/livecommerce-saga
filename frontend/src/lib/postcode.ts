type PostcodeResult = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
};

type PostcodeConstructor = new (options: { oncomplete: (data: PostcodeResult) => void }) => { open: () => void };

declare global {
  interface Window {
    daum?: { Postcode: PostcodeConstructor };
  }
}

const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.daum?.Postcode !== undefined) {
    return Promise.resolve();
  }
  if (loading !== null) {
    return loading;
  }
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("postcode script failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function searchPostcode(): Promise<{ zipCode: string; address: string } | null> {
  await loadScript();
  const Postcode = window.daum?.Postcode;
  if (Postcode === undefined) {
    return null;
  }
  return new Promise((resolve) => {
    new Postcode({
      oncomplete: (data) => {
        const base = data.roadAddress !== "" ? data.roadAddress : data.jibunAddress;
        const address = data.buildingName !== "" ? `${base} (${data.buildingName})` : base;
        resolve({ zipCode: data.zonecode, address });
      }
    }).open();
  });
}
