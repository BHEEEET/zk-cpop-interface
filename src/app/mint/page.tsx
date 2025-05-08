"use client";

import QRCode from "react-qr-code";

export default function GoogleQrCode() {
  return (
    <div className="p-8 flex justify-center items-center">
      <QRCode value="https://youtu.be/AmtW7u2xFQI?si=w9Y9BeKksGx7Hna4&t=21" size={400} />
    </div>
  );
}
