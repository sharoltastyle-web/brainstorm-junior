import styles from './Logo.module.css';

export function Logo({ className }: { className?: string }) {
  return (
    <img
      className={className ? `${styles.logo} ${className}` : styles.logo}
      src="/images/logo.png"
      alt="BrainStorm ג'וניור"
      width={1200}
      height={600}
    />
  );
}
