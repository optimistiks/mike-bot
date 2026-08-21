import "./arcade.css";

export default function V2UIPrototypeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="arcade">{children}</div>;
}
