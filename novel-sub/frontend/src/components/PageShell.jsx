import { Typography } from 'antd';

export default function PageShell({ title, extra, children }) {
  return (
    <div className="novel-page">
      {(title || extra) && (
        <div className="novel-page-header">
          {title && (
            <Typography.Title level={4} className="novel-page-title">
              {title}
            </Typography.Title>
          )}
          {extra && <div className="novel-page-extra">{extra}</div>}
        </div>
      )}
      <div className="novel-page-body">{children}</div>
    </div>
  );
}
