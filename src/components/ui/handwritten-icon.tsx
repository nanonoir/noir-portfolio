import {
  AppWindowSearchText,
  AppWindowSourceCode,
  BookmarksDocument,
  BusinessDealHandshake,
  CalendarGrid,
  CreativityIdeaBulb,
  DownloadBrackets,
  ECommerceOnlineShop,
  FormValidationCheckDouble,
  FormValidationCheckSquare1,
  FormValidationRemoveSquare,
  JobBriefcaseDocument,
  LightModeBrightnessHalf,
  MenuNavigation2,
  NavigationPageRight,
  OfficeBusinessCard,
  OfficeStampDocument,
  OptimizationConfiguration,
  PerformanceIncreaseClipboard,
  PhoneActions24HoursCall,
  RemoveDeleteSignBold,
  SendEmailFly,
  SettingsCogDouble1,
  Shop,
  SmartphoneAppWidgetTranslator,
  ViewEye1,
  WebsiteDevelopmentBrowserPageLayout,
  WorkflowCollaborate,
  AlertsWarningTriangle,
  BugCloudError,
  Home,
} from "@nanonoir/freehand-icons";
import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";

const HANDWRITTEN_ICONS = {
  architecture: AppWindowSourceCode,
  audit: AppWindowSearchText,
  automation: SettingsCogDouble1,
  calendar: CalendarGrid,
  card: OfficeBusinessCard,
  check: FormValidationCheckSquare1,
  checkDouble: FormValidationCheckDouble,
  close: RemoveDeleteSignBold,
  diploma: BookmarksDocument,
  download: DownloadBrackets,
  education: OfficeStampDocument,
  error: FormValidationRemoveSquare,
  handshake: BusinessDealHandshake,
  home: Home,
  language: SmartphoneAppWidgetTranslator,
  landing: WebsiteDevelopmentBrowserPageLayout,
  menu: MenuNavigation2,
  moon: LightModeBrightnessHalf,
  project: AppWindowSourceCode,
  rightArrow: NavigationPageRight,
  rightChevron: NavigationPageRight,
  service: OptimizationConfiguration,
  store: Shop,
  sun: LightModeBrightnessHalf,
  toolbox: JobBriefcaseDocument,
  valueAudit: CreativityIdeaBulb,
  valueLanding: PerformanceIncreaseClipboard,
  valueEcommerce: ECommerceOnlineShop,
  valueAutomation: WorkflowCollaborate,
  view: ViewEye1,
  warning: AlertsWarningTriangle,
  networkError: BugCloudError,
  send: SendEmailFly,
  phone: PhoneActions24HoursCall,
} as const;

const FALLBACK_SOURCES = {
  about: "/handwritten-icons/about.svg",
  github: "/handwritten-icons/github.svg",
  linkedIn: "/handwritten-icons/linkedIn.svg",
  whatsapp: "/handwritten-icons/whatsapp.svg",
  // The legacy icon inventory has no email.svg; card.svg is its email/contact mark.
  email: "/handwritten-icons/card.svg",
  pause: "/handwritten-icons/pause.svg",
  play: "/handwritten-icons/play.svg",
  request: "/handwritten-icons/request.svg",
} as const;

export type HandwrittenIconName = keyof typeof HANDWRITTEN_ICONS | keyof typeof FALLBACK_SOURCES;

type HandwrittenIconProps = ComponentPropsWithoutRef<"svg"> & {
  fallbackSrc?: string;
  icon?: HandwrittenIconName;
  size?: number;
};

/** Renders a package icon or its legacy SVG fallback. */
export function HandwrittenIcon({
  className,
  fallbackSrc,
  height,
  icon,
  size = 16,
  width,
  ...props
}: HandwrittenIconProps) {
  const resolvedHeight = height ?? size;
  const resolvedWidth = width ?? size;
  const imageHeight = typeof resolvedHeight === "number" ? resolvedHeight : size;
  const imageWidth = typeof resolvedWidth === "number" ? resolvedWidth : size;

  if (fallbackSrc) {
    const src = FALLBACK_SOURCES[fallbackSrc as keyof typeof FALLBACK_SOURCES] ?? fallbackSrc;

    return <Image alt="" aria-hidden="true" className={["dark:invert", className].filter(Boolean).join(" ")} height={imageHeight} src={src} width={imageWidth} />;
  }

  if (icon && icon in HANDWRITTEN_ICONS) {
    const IconComponent = HANDWRITTEN_ICONS[icon as keyof typeof HANDWRITTEN_ICONS];

    return (
      <IconComponent
        {...props}
        aria-hidden="true"
        className={className}
        color="currentColor"
        focusable="false"
        height={resolvedHeight}
        size={size}
        width={resolvedWidth}
      />
    );
  }

  const src = icon ? FALLBACK_SOURCES[icon as keyof typeof FALLBACK_SOURCES] : undefined;

  if (!src) {
    return null;
  }

  return <Image alt="" aria-hidden="true" className={["dark:invert", className].filter(Boolean).join(" ")} height={imageHeight} src={src} width={imageWidth} />;
}
