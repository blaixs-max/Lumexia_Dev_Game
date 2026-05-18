// ============================================================================
// DEV MODE LAUNCHER - Wallet/Purchase/Agreement akisi tamamen deaktif.
// ----------------------------------------------------------------------------
// Orijinal RealLauncherUI 1600+ satirdi: Solana wallet adapter, Connect Wallet,
// Purchase Coin (TOKABU SPL transfer), Agreement screen, fiyat polling, kredi
// yukleme - hepsi prod entegrasyonlari. Bu dosya HUD/Game test icin minimal
// bir dev menusune dusuruldu. Sadece "START GAME" ve mode secimi var.
// ============================================================================

import { useState } from 'react';
import { MOCK_CREDITS } from '../devMode';

const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  bgPrimary: '#0B0B0F',
  bgCard: '#1A1625',
  textPrimary: '#E8E8E8',
  textSecondary: '#8B8B9A',
};

const RealLauncherUI = ({ onStartGame }) => {
  const [gameMode, setGameMode] = useState('classic');

  const handleStart = () => {
    onStartGame({
      walletAddress: 'DEV_MODE_LOCAL_WALLET',
      credits: MOCK_CREDITS,
      gameMode,
    });
  };

  const modeBtn = (mode, label, sub) => {
    const active = gameMode === mode;
    return (
      <button
        onClick={() => setGameMode(mode)}
        style={{
          flex: 1,
          padding: '14px',
          borderRadius: '12px',
          border: active ? `2px solid ${COLORS.green}` : '1px solid rgba(255,255,255,0.1)',
          background: active ? 'rgba(20,241,149,0.08)' : 'rgba(255,255,255,0.03)',
          color: active ? COLORS.green : COLORS.textSecondary,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          textAlign: 'left',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 400 }}>{sub}</div>
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: `linear-gradient(180deg, ${COLORS.bgPrimary} 0%, #13111C 100%)`,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: COLORS.textPrimary,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: COLORS.bgCard,
          borderRadius: '24px',
          border: `1px solid rgba(153,69,255,0.25)`,
          padding: '32px',
          boxShadow: `0 20px 60px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(20,241,149,0.12)',
              color: COLORS.green,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              marginBottom: 12,
            }}
          >
            DEV MODE
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '4px',
              background: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.green})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            LUMEXIA
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: COLORS.textSecondary }}>
            HUD / Game test ortami
          </p>
        </div>

        {/* Disabled integrations notice */}
        <div
          style={{
            background: 'rgba(255,200,80,0.06)',
            border: '1px solid rgba(255,200,80,0.2)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: '12px',
            color: '#FFC850',
            lineHeight: 1.5,
          }}
        >
          Wallet, Purchase, Supabase ve Score kayit entegrasyonlari deaktif.
          Sadece oyun/HUD test edilebilir.
        </div>

        {/* Game Mode Selection */}
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '11px',
              letterSpacing: '2px',
              color: COLORS.textSecondary,
              fontWeight: 600,
            }}
          >
            GAME MODE
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {modeBtn('classic', 'Classic', 'Standart yaris')}
            {modeBtn('doubleOrNothing', 'Double / Nothing', 'Lvl 5 = 2x, yoksa 0')}
          </div>
        </div>

        {/* Mock credits display */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            marginBottom: 20,
            fontSize: '13px',
          }}
        >
          <span style={{ color: COLORS.textSecondary }}>Mock Credits</span>
          <span style={{ color: '#FFD700', fontWeight: 700 }}>{MOCK_CREDITS}</span>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: '14px',
            border: 'none',
            background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.green})`,
            color: '#fff',
            fontSize: '16px',
            fontWeight: 800,
            letterSpacing: '2px',
            cursor: 'pointer',
            boxShadow: `0 8px 30px rgba(153,69,255,0.35)`,
          }}
        >
          START GAME
        </button>

        <p
          style={{
            margin: '16px 0 0',
            textAlign: 'center',
            fontSize: '11px',
            color: COLORS.textSecondary,
            opacity: 0.7,
          }}
        >
          Prod entegrasyonlari icin src/devMode.js'e bakin.
        </p>
      </div>
    </div>
  );
};

export default RealLauncherUI;
