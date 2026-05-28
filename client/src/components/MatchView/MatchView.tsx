import React from 'react';
import { MatchData, ProductId } from '../../types';
import styles from './MatchView.module.css';

interface Props {
  matches: MatchData[];
  subscribedProducts: Set<ProductId>;
}

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
  } catch {
    return iso;
  }
};

const MatchView: React.FC<Props> = ({ matches, subscribedProducts }) => {
  const visibleMatches = matches.filter((m) =>
    subscribedProducts.has(m.productId as ProductId)
  );

  return (
    <section className={styles.container}>
      <h2 className={styles.title}>Match View</h2>
      {visibleMatches.length === 0 ? (
        <p className={styles.empty}>
          {subscribedProducts.size === 0
            ? 'Subscribe to a product to see trades.'
            : 'Waiting for trades…'}
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            {/* Fixed column widths keep numeric cells tight and aligned */}
            <colgroup>
              <col className={styles.colTime} />
              <col className={styles.colProduct} />
              <col className={styles.colSide} />
              <col className={styles.colSize} />
              <col className={styles.colPrice} />
            </colgroup>
            <thead>
              <tr>
                <th>Time</th>
                <th>Product</th>
                <th>Side</th>
                <th className={styles.right}>Size</th>
                <th className={styles.right}>Price</th>
              </tr>
            </thead>
            <tbody>
              {visibleMatches.map((m) => (
                <tr
                  key={`${m.tradeId}-${m.productId}`}
                  className={m.side === 'buy' ? styles.buy : styles.sell}
                >
                  <td className={styles.mono}>{formatTime(m.time)}</td>
                  <td>{m.productId}</td>
                  <td className={styles.side}>{m.side.toUpperCase()}</td>
                  <td className={`${styles.mono} ${styles.right}`}>
                    {parseFloat(m.size).toFixed(6)}
                  </td>
                  <td className={`${styles.mono} ${styles.right}`}>
                    {parseFloat(m.price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default MatchView;
