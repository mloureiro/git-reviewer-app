import { html, parse } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

interface DiffViewProps {
  diffText: string;
}

export function DiffView({ diffText }: DiffViewProps) {
  const diffJson = parse(diffText);
  const diffHtml = html(diffJson, {
    outputFormat: 'line-by-line',
    drawFileList: true,
    matching: 'lines',
    colorScheme: 'auto',
  });

  return <div className="diff-container" dangerouslySetInnerHTML={{ __html: diffHtml }} />;
}
