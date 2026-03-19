import { html, parse } from 'diff2html';
import { ColorSchemeType } from 'diff2html/lib-esm/types';
import 'diff2html/bundles/css/diff2html.min.css';

interface DiffViewProps {
  diffText: string;
  colorScheme?: ColorSchemeType;
}

function filePathToId(filePath: string): string {
  return `file-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
}

export function DiffView({ diffText, colorScheme = ColorSchemeType.AUTO }: DiffViewProps) {
  const diffFiles = parse(diffText);

  if (diffFiles.length === 0) {
    return null;
  }

  return (
    <div className="diff-view">
      {diffFiles.map((file) => {
        const filePath = file.isRename === true ? file.newName : file.newName || file.oldName;
        const sectionId = filePathToId(filePath);
        const fileHtml = html([file], {
          outputFormat: 'line-by-line',
          drawFileList: false,
          matching: 'lines',
          colorScheme,
        });

        return (
          <section key={sectionId} id={sectionId} className="diff-file-section">
            <div className="diff-file-section__header">
              <span className="diff-file-section__filename">{filePath}</span>
            </div>
            <div className="diff-container" dangerouslySetInnerHTML={{ __html: fileHtml }} />
          </section>
        );
      })}
    </div>
  );
}
