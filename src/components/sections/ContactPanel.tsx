import { CONTACT_NOTE, SOCIALS } from '../../content/data'
import { useApp } from '../../lib/store'
import { ICONS, IconArrow } from '../Icons'

/**
 * 05 联系我 —— 一段说明 + 联系方式卡片。
 *
 * 这是整站唯一有明确行动号召的板块，所以联系方式给足视觉重量，
 * 不做任何折叠。
 *
 * 每张卡片给三层信息：类型（电话/邮箱/代码仓库）、值、跳转箭头。
 * ⚠️ 原来只显示值不显示类型 —— 一串号码和一个邮箱并排时，
 * 要靠图标去猜哪个是哪个，多一行类型标签就不用猜了。
 */
export function ContactPanel() {
  const lang = useApp((s) => s.lang)

  return (
    <div className="pl-contact">
      <p className="ct-note">{CONTACT_NOTE[lang]}</p>

      <ul className="ct-links">
        {SOCIALS.map((s) => {
          const Icon = ICONS[s.icon]
          const external = !/^(mailto:|tel:)/.test(s.href)
          return (
            <li key={s.id}>
              <a
                className="ct-link"
                href={s.href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
              >
                <span className="ct-icon-box">
                  <Icon className="ct-icon" />
                </span>
                <span className="ct-text">
                  <span className="ct-kind hud-mono">{s.name[lang]}</span>
                  {/*
                    值可能很长（邮箱 24 字符）而卡片有限宽。
                    不用 ellipsis —— 截断的邮箱地址等于没有。
                    改为允许在任意字符处换行。
                  */}
                  <span className="ct-label">{s.label}</span>
                </span>
                <IconArrow className="ct-arrow" />
              </a>
            </li>
          )
        })}
      </ul>

    </div>
  )
}
