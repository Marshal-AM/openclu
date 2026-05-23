import ReactMarkdown from 'react-markdown';
import { stripSkillPreviewContent } from '../../lib/skill-md';
import './SkillMarkdownPreview.css';

type SkillMarkdownPreviewProps = {
  content: string;
  variant?: 'card' | 'detail';
  emptyLabel?: string;
};

export function SkillMarkdownPreview({
  content,
  variant = 'detail',
  emptyLabel = 'Skill content unavailable',
}: SkillMarkdownPreviewProps) {
  const trimmed = stripSkillPreviewContent(content).trim();

  return (
    <div className={`skill-markdown-preview skill-markdown-preview--${variant}`}>
      {trimmed ? (
        <ReactMarkdown>{trimmed}</ReactMarkdown>
      ) : (
        <p className="skill-markdown-empty">{emptyLabel}</p>
      )}
    </div>
  );
}
