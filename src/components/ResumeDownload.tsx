import { RESUME_PDF, UI } from '../content/data'
import { useApp } from '../lib/store'
import { IconDownload } from './Icons'

/**
 * 下载 PDF 简历。
 *
 * 两处在用（联系我板块、个人信息板块），所以抽成一个组件 ——
 * 文件名和文案只有一处定义，改简历不用两边同步。
 *
 * ⚠️ 走的是**静态文件**，不是前端现场生成 PDF。
 * 现场生成要把中文字体（最小也有几 MB）打进 bundle，
 * 而这个站是零依赖、轻量优先的；PDF 由 `npm run pdf` 在构建机上生成，
 * 直接放 public/ 下当静态资源发。
 *
 * ⚠️ href 必须带 BASE_URL —— 站点部署在 GitHub Pages 的子路径下，
 * 写死 `/resume-....pdf` 会 404。
 * download 属性给的是**中文**文件名：URL 里放中文要转义、不好看，
 * 但对方存到本地时看到的应该是「赫卫东-数据开发工程师-简历.pdf」。
 */
export function ResumeDownload({ compact = false }: { compact?: boolean }) {
  const lang = useApp((s) => s.lang)
  return (
    <a
      className={`dl-resume${compact ? ' is-compact' : ''}`}
      href={`${import.meta.env.BASE_URL}${RESUME_PDF.file}`}
      download={RESUME_PDF.as}
    >
      <span className="dl-icon">
        <IconDownload />
      </span>
      <span className="dl-text">
        <b>{UI.downloadResume[lang]}</b>
        {!compact && <em className="hud-mono">{UI.downloadResumeHint[lang]}</em>}
      </span>
      {/* 扫过去的一道光，和小屏的开机扫描线是同一套语言 */}
      <span className="dl-sweep" aria-hidden="true" />
    </a>
  )
}
