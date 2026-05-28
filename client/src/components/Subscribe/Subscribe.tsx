import React from 'react';
import { ProductId, SUPPORTED_PRODUCTS } from '../../types';
import styles from './Subscribe.module.css';

interface Props {
  subscribedProducts: Set<ProductId>;
  onSubscribe: (productId: ProductId) => void;
  onUnsubscribe: (productId: ProductId) => void;
}

const Subscribe: React.FC<Props> = ({ subscribedProducts, onSubscribe, onUnsubscribe }) => {
  return (
    <section className={styles.container}>
      <h2 className={styles.title}>Subscribe / Unsubscribe</h2>
      <div className={styles.grid}>
        {SUPPORTED_PRODUCTS.map((product) => {
          const isSubscribed = subscribedProducts.has(product);
          return (
            <div key={product} className={styles.card}>
              <span className={styles.productLabel}>{product}</span>
              <span
                className={`${styles.badge} ${isSubscribed ? styles.badgeActive : styles.badgeInactive}`}
              >
                {isSubscribed ? 'Subscribed' : 'Unsubscribed'}
              </span>
              <button
                className={`${styles.btn} ${isSubscribed ? styles.btnUnsubscribe : styles.btnSubscribe}`}
                onClick={() =>
                  isSubscribed ? onUnsubscribe(product) : onSubscribe(product)
                }
              >
                {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Subscribe;
