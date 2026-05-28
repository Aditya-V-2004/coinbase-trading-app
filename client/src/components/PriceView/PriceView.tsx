import React from 'react';
import { ProductId, OrderBookSnapshot } from '../../types';
import styles from './PriceView.module.css';

interface Props {
  orderBooks: Map<ProductId, OrderBookSnapshot>;
  subscribedProducts: Set<ProductId>;
}

const PriceView: React.FC<Props> = ({ orderBooks, subscribedProducts }) => {
  if (subscribedProducts.size === 0) {
    return (
      <section className={styles.container}>
        <h2 className={styles.title}>Price View</h2>
        <p className={styles.empty}>No products subscribed.</p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <h2 className={styles.title}>Price View</h2>
      <div className={styles.books}>
        {Array.from(subscribedProducts).map((product) => {
          const snap = orderBooks.get(product);
          return (
            <div key={product} className={styles.book}>
              <h3 className={styles.productName}>{product}</h3>
              <div className={styles.sides}>

                {/* ── Bids ── */}
                <div className={styles.side}>
                  <div className={styles.sideTitle}>Bids</div>
                  <div className={styles.sideHeader}>
                    <span />
                    <span>Price</span>
                    <span>Size</span>
                  </div>
                  {snap && snap.bids.length > 0 ? (
                    snap.bids.map((level) => (
                      <div key={level.price} className={`${styles.level} ${styles.bid}`}>
                        <span className={styles.dot} />
                        <span>{parseFloat(level.price).toFixed(2)}</span>
                        <span>{parseFloat(level.size).toFixed(6)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noData}>Waiting…</div>
                  )}
                </div>

                {/* ── Asks ── */}
                <div className={styles.side}>
                  <div className={styles.sideTitle}>Asks</div>
                  <div className={styles.sideHeader}>
                    <span />
                    <span>Price</span>
                    <span>Size</span>
                  </div>
                  {snap && snap.asks.length > 0 ? (
                    snap.asks.map((level) => (
                      <div key={level.price} className={`${styles.level} ${styles.ask}`}>
                        <span className={styles.dot} />
                        <span>{parseFloat(level.price).toFixed(2)}</span>
                        <span>{parseFloat(level.size).toFixed(6)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noData}>Waiting…</div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PriceView;
