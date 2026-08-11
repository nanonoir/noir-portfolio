import { ImageResponse } from "next/og";

export const alt = "Nahuel Nicolas Noir — Full-Stack Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f7f7f5",
          color: "#171717",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: 32, letterSpacing: "0.18em" }}>NOIRNAHUEL.COM</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 700 }}>Nahuel Nicolas Noir</div>
          <div style={{ color: "#5f5f5f", fontSize: 34 }}>Full-Stack Developer</div>
        </div>
      </div>
    ),
    size,
  );
}
