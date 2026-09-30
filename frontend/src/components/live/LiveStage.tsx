import { LIVE_VIDEO_URL } from "@/lib/config";
import { t } from "@/i18n/core";

type LiveStageProps = {
  hostName: string;
};

export function LiveStage({ hostName }: LiveStageProps) {
  if (LIVE_VIDEO_URL !== "") {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={LIVE_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        aria-label={t("live.stageAria", { host: hostName })}
      />
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-pine-600">
      <div className="knit-texture absolute inset-0 animate-drift motion-reduce:animate-none" aria-hidden="true" />
      <div className="stage-light absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-x-0 top-[15%] flex flex-col items-center gap-3 px-8 text-center">
        <div
          className="grid h-24 w-24 place-items-center rounded-full bg-cranberry text-[40px] font-bold text-frost ring-4 ring-frost/25"
          aria-hidden="true"
        >
          {hostName.slice(0, 1)}
        </div>
        <p className="max-w-[18rem] text-[12px] leading-relaxed text-frost/70 [@media(max-height:760px)]:hidden">
          {t("live.stageNotice")}
        </p>
      </div>
    </div>
  );
}
