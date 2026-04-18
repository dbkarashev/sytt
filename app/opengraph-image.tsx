import { ImageResponse } from "next/og";

export const alt = "save yourself this time — anonymous stories for anyone holding on";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse at center, #0f1a2b 0%, #0d1321 50%, #070b14 100%)",
          color: "rgba(255,255,255,0.9)",
          fontFamily: "Georgia, serif",
          position: "relative",
          padding: 60,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "18%",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(224,155,92,0.85) 0%, rgba(212,134,78,0.35) 60%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "62%",
            left: "72%",
            width: 60,
            height: 60,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(107,138,158,0.8) 0%, rgba(107,138,158,0.25) 60%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "78%",
            width: 50,
            height: 50,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(224,155,92,0.7) 0%, rgba(212,134,78,0.25) 60%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "70%",
            left: "20%",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(107,138,158,0.6) 0%, rgba(107,138,158,0.2) 60%, transparent 100%)",
          }}
        />

        <div
          style={{
            fontSize: 84,
            fontStyle: "italic",
            letterSpacing: -1,
            lineHeight: 1.1,
            color: "rgba(255,255,255,0.95)",
            display: "flex",
            textAlign: "center",
          }}
        >
          save yourself this time.
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            color: "rgba(255,255,255,0.6)",
            textAlign: "center",
            maxWidth: 820,
            lineHeight: 1.4,
            display: "flex",
          }}
        >
          you don&apos;t have to fix it tonight. you just have to stay.
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 17,
            color: "#c9935a",
            letterSpacing: 6,
            display: "flex",
          }}
        >
          anonymous stories · for anyone holding on
        </div>
      </div>
    ),
    { ...size },
  );
}
