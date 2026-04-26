import './globals.css';

export const metadata = {
  title: '日语单词练习',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
