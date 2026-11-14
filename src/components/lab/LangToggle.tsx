import { LANGS, useI18n } from '../../lib/lab/i18n'

type Props = {
  className?: string
}

/** Conmutador ES/EN. El idioma elegido se recuerda en el navegador. */
export default function LangToggle({ className = '' }: Props) {
  const { lang, setLang, t } = useI18n()
  return (
    <div role="group" aria-label={t.language} className={`flex items-center font-code text-[12px] ${className}`}>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`rounded-lg px-2.5 py-1.5 tracking-wider uppercase transition ${
            lang === code ? 'bg-lab-bg2 text-lab-fg' : 'text-lab-muted hover:text-lab-fg'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
