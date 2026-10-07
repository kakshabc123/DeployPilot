const LANDING_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4";

export function VideoBackground({ src = LANDING_VIDEO }: { src?: string }) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#06111d]" aria-hidden="true">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03101b]/65 via-[#04101b]/55 to-[#03070c]/85" />
      <div className="absolute inset-0 bg-[#06101a]/25" />
    </div>
  );
}
