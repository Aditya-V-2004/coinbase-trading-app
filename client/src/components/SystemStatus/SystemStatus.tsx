import React from 'react';
import { ChannelEntry } from '../../types';
import styles from './SystemStatus.module.css';

interface Props {
  channels: ChannelEntry[];
  connected: boolean;
}

const SystemStatus: React.FC<Props> = ({ channels, connected }) => {
  return (
    <section className={styles.container}>
      <h2 className={styles.title}>System Status</h2>

      <div className={styles.connectionRow}>
        <span className={styles.connLabel}>WebSocket</span>
        <span className={`${styles.dot} ${connected ? styles.dotGreen : styles.dotRed}`} />
        <span className={connected ? styles.textGreen : styles.textRed}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <h3 className={styles.subTitle}>Active Coinbase Channels</h3>
      {channels.length === 0 ? (
        <p className={styles.empty}>No active channels.</p>
      ) : (
        <div className={styles.channels}>
          {channels.map((ch) => (
            <div key={ch.name} className={styles.channelCard}>
              <div className={styles.channelName}>{ch.name}</div>
              <div className={styles.productList}>
                {ch.product_ids.length > 0 ? (
                  ch.product_ids.map((pid) => (
                    <span key={pid} className={styles.productTag}>
                      {pid}
                    </span>
                  ))
                ) : (
                  <span className={styles.none}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default SystemStatus;
