import * as React from 'react';

export interface LineItem {
  name: string;
  thumbnail: string | null;
  quantity: number;
  price: number; // in cents
  currency: string;
}

interface ReceiptTemplateProps {
  firstName: string;
  orderNumber: string;
  lineItems: LineItem[];
}

export function ReceiptTemplate({ firstName, orderNumber, lineItems }: ReceiptTemplateProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', color: '#333' }}>

      {/* Header - product thumbnail as banner */}
      {lineItems[0]?.thumbnail && (
        <img
          src={lineItems[0].thumbnail}
          alt={lineItems[0].name}
          style={{ width: '100%', borderRadius: '8px 8px 0 0', objectFit: 'cover', maxHeight: '200px' }}
        />
      )}

      {/* Confirmation message */}
      <div style={{ textAlign: 'center', padding: '24px 16px 8px' }}>
        <p style={{ margin: 0, color: '#555' }}>
          You're in {firstName}, here is your order confirmation for:
        </p>
        <h1 style={{ margin: '8px 0 0', fontSize: '22px' }}>
          {lineItems[0]?.name}
        </h1>
      </div>

      {/* Line items */}
      <div style={{ padding: '16px', borderTop: '1px solid #eee', marginTop: '16px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Your order</h2>
        {lineItems.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                alt={item.name}
                style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{item.name}</p>
              <p style={{ margin: 0, color: '#777', fontSize: '14px' }}>Qty: {item.quantity}</p>
            </div>
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {new Intl.NumberFormat('en-AU', {
                style: 'currency',
                currency: item.currency.toUpperCase(),
              }).format(item.price / 100)}
            </p>
          </div>
        ))}
      </div>

      {/* Order number */}
      <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid #eee' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
          <strong>Order number:</strong> {orderNumber}
        </p>
      </div>

    </div>
  );
}