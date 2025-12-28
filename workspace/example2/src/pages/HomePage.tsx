import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

type Category = {
  id: string;
  name: string;
  to: string;
};

type Product = {
  id: string;
  name: string;
  priceText: string;
  imageAlt: string;
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const HomePage: React.FC = () => {
  const categories: Category[] = useMemo(
    () => [
      { id: 'cat-new', name: '新品推荐', to: '/products' },
      { id: 'cat-sale', name: '限时特惠', to: '/products' },
      { id: 'cat-electronics', name: '数码家电', to: '/products' },
      { id: 'cat-home', name: '家居日用', to: '/products' },
    ],
    []
  );

  const recommended: Product[] = useMemo(
    () => [
      { id: '101', name: '示例商品 A', priceText: '¥199.00', imageAlt: '示例商品 A 图片' },
      { id: '102', name: '示例商品 B', priceText: '¥299.00', imageAlt: '示例商品 B 图片' },
      { id: '103', name: '示例商品 C', priceText: '¥399.00', imageAlt: '示例商品 C 图片' },
      { id: '104', name: '示例商品 D', priceText: '¥499.00', imageAlt: '示例商品 D 图片' },
    ],
    []
  );

  return (
    <main
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
      aria-label="首页"
    >
      <section aria-label="Banner">
        <Card>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: 16,
              alignItems: 'center',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>发现你的下一件心动好物</h1>
              <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.6 }}>
                精选推荐、快速下单、安心配送。立即浏览全部商品列表，或从分类入口开始探索。
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/products" aria-label="前往商品列表">
                  <Button>查看全部商品</Button>
                </Link>
                <Link to="/products/101" aria-label="前往示例商品详情">
                  <Button variant="secondary">查看示例商品</Button>
                </Link>
              </div>
            </div>

            <div
              style={{
                height: 140,
                borderRadius: 12,
                background:
                  'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(16,185,129,0.18))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              aria-label="Banner 装饰区域"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.9 }}>
                <Spinner />
                <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>加载更多精选内容中…</span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section aria-label="分类入口">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: '8px 0' }}>分类入口</h2>
          <Link to="/products" style={{ textDecoration: 'none' }} aria-label="更多分类（跳转到商品列表）">
            <Button size="sm" variant="ghost">
              更多
            </Button>
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {categories.map((c) => (
            <Link
              key={c.id}
              to={c.to}
              style={{ textDecoration: 'none', color: 'inherit' }}
              aria-label={`前往分类：${c.name}`}
            >
              <Card>
                <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>去逛逛</div>
                  </div>
                  <span aria-hidden="true" style={{ opacity: 0.6 }}>
                    →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="推荐商品列表">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: '8px 0' }}>推荐商品</h2>
          <Link to="/products" style={{ textDecoration: 'none' }} aria-label="查看更多推荐（跳转到商品列表）">
            <Button size="sm" variant="ghost">
              查看更多
            </Button>
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {recommended.map((p) => (
            <Card key={p.id}>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    height: 120,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                  aria-label={p.imageAlt}
                >
                  <span style={{ fontSize: 12, opacity: 0.7 }}>图片占位</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    className={cx('line-clamp-2')}
                    style={{
                      fontWeight: 600,
                      lineHeight: 1.3,
                      minHeight: 34,
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>{p.priceText}</div>
                    <Link to={`/products/${encodeURIComponent(p.id)}`} aria-label={`查看商品详情：${p.name}`}>
                      <Button size="sm">查看</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
};

export default HomePage;