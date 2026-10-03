import Image from "next/image";
import AuthScene from "./auth-scene";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <AuthScene />
        <div className="auth-visual-content">
          <p className="auth-visual-headline">
            Keep every task
            <br />
            <span>in sight.</span>
          </p>
          <p className="auth-visual-caption">The little things are easier to manage when they stay in view.</p>
        </div>
      </div>
      <div className="auth-side">
        <div className="auth-brand" aria-label="Bird-Watcher">
          <Image src="/brand/munia-logo.png" alt="" width={72} height={77} priority />
          <span>
            Bird-
            <br />
            Watcher
          </span>
        </div>
        <main className="auth-content">{children}</main>
        <footer className="auth-footer">Personal · Team · Research</footer>
      </div>
    </div>
  );
}
