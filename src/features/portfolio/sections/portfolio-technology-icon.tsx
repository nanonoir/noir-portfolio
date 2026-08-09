import type { IconType } from "react-icons";
import { DiCode, DiTerminal } from "react-icons/di";
import { FaSlack } from "react-icons/fa6";
import {
  SiAstro,
  SiClaudecode,
  SiCss,
  SiDocker,
  SiExpress,
  SiGit,
  SiGithub,
  SiHtml5,
  SiJavascript,
  SiJira,
  SiLinux,
  SiModelcontextprotocol,
  SiMongodb,
  SiMysql,
  SiN8N,
  SiNestjs,
  SiNextdotjs,
  SiNginx,
  SiNodedotjs,
  SiNotion,
  SiOpencode,
  SiPostgresql,
  SiPostman,
  SiPrisma,
  SiRailway,
  SiReact,
  SiSequelize,
  SiTailwindcss,
  SiTrello,
  SiTypescript,
  SiVercel,
  SiVuedotjs,
} from "react-icons/si";

const TECHNOLOGY_ICON_BY_NAME: Record<string, IconType> = {
  Astro: SiAstro,
  "CI/CD": DiCode,
  "Claude Code": SiClaudecode,
  CSS: SiCss,
  Docker: SiDocker,
  Express: SiExpress,
  Git: SiGit,
  GitHub: SiGithub,
  HTML: SiHtml5,
  JavaScript: SiJavascript,
  Jira: SiJira,
  JWT: DiCode,
  Linux: SiLinux,
  MCP: SiModelcontextprotocol,
  MongoDB: SiMongodb,
  MySQL: SiMysql,
  n8n: SiN8N,
  NestJS: SiNestjs,
  "Next.js": SiNextdotjs,
  Nginx: SiNginx,
  "Node.js": SiNodedotjs,
  Notion: SiNotion,
  OpenCode: SiOpencode,
  PostgreSQL: SiPostgresql,
  Postman: SiPostman,
  Prisma: SiPrisma,
  Railway: SiRailway,
  React: SiReact,
  "React Native": SiReact,
  "REST APIs": DiCode,
  Sequelize: SiSequelize,
  Slack: FaSlack,
  TailwindCSS: SiTailwindcss,
  Trello: SiTrello,
  TypeScript: SiTypescript,
  Vercel: SiVercel,
  "Vue.js": SiVuedotjs,
  VPS: DiTerminal,
  Webhooks: DiCode,
};

const TECHNOLOGY_COLOR_BY_NAME: Record<string, string> = {
  Astro: "#BC52EE",
  "CI/CD": "#10B981",
  "Claude Code": "#D97757",
  CSS: "#1572B6",
  Docker: "#2496ED",
  Express: "currentColor",
  Git: "#F05032",
  GitHub: "currentColor",
  HTML: "#E34F26",
  JavaScript: "#F7DF1E",
  Jira: "#0052CC",
  JWT: "#8B5CF6",
  Linux: "#FCC624",
  MCP: "#8B5CF6",
  MongoDB: "#47A248",
  MySQL: "#4479A1",
  n8n: "#EA4B71",
  NestJS: "#E0234E",
  "Next.js": "currentColor",
  Nginx: "#009639",
  "Node.js": "#5FA04E",
  Notion: "currentColor",
  OpenCode: "currentColor",
  PostgreSQL: "#4169E1",
  Postman: "#FF6C37",
  Prisma: "#2D3748",
  Railway: "currentColor",
  React: "#61DAFB",
  "React Native": "#61DAFB",
  "REST APIs": "#10B981",
  Sequelize: "#52B0E7",
  Slack: "#4A154B",
  TailwindCSS: "#06B6D4",
  Trello: "#0052CC",
  TypeScript: "#3178C6",
  Vercel: "currentColor",
  "Vue.js": "#4FC08D",
  VPS: "#8B5CF6",
  Webhooks: "#10B981",
};

export function PortfolioTechnologyIcon({
  className,
  name,
  size,
}: {
  className?: string;
  name: string;
  size: number;
}) {
  const IconComponent = TECHNOLOGY_ICON_BY_NAME[name] ?? DiCode;

  return (
    <IconComponent
      aria-hidden="true"
      className={className}
      focusable="false"
      size={size}
      style={{ color: TECHNOLOGY_COLOR_BY_NAME[name] ?? "currentColor" }}
    />
  );
}
