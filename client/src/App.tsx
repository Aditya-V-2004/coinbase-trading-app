import React from 'react';
import { useSocket } from './hooks/useSocket';
import Subscribe from './components/Subscribe/Subscribe';
import PriceView from './components/PriceView/PriceView';
import MatchView from './components/MatchView/MatchView';
import SystemStatus from './components/SystemStatus/SystemStatus';
import styles from './App.module.css';

const App: React.FC = () => {
  const {
    connected,
    subscribedProducts,
    orderBooks,
    matches,
    channels,
    serverError,
    subscribe,
    unsubscribe,
  } = useSocket();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Coinbase Exchange Live Feed</h1>
        <div className={styles.headerRight}>
          <span className={`${styles.statusDot} ${connected ? styles.dotGreen : styles.dotRed}`} />
          <span className={styles.statusText}>{connected ? 'Live' : 'Connecting…'}</span>
        </div>
      </header>

      {serverError && (
        <div className={styles.errorBanner} role="alert">
          {serverError}
        </div>
      )}

      <main className={styles.grid}>
        <div className={styles.cell}>
          <Subscribe
            subscribedProducts={subscribedProducts}
            onSubscribe={subscribe}
            onUnsubscribe={unsubscribe}
          />
        </div>

        <div className={styles.cell}>
          <SystemStatus channels={channels} connected={connected} />
        </div>

        <div className={`${styles.cell} ${styles.span2}`}>
          <PriceView orderBooks={orderBooks} subscribedProducts={subscribedProducts} />
        </div>

        <div className={`${styles.cell} ${styles.span2}`}>
          <MatchView matches={matches} subscribedProducts={subscribedProducts} />
        </div>
      </main>
    </div>
  );
};

export default App;
