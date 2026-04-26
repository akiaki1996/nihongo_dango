import './globals.css';

export const metadata = {
  title: 'にほんご — 日语单词练习',
  description: '个人日语单词练习工具',
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
