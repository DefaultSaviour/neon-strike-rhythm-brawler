using System;
using UnityEngine;

namespace NeonStrike.Core
{
    public enum Lane
    {
        Left = 0,
        Right = 1
    }

    public enum FrequencyBand
    {
        Sub = 0,   // Kicks & Sub (36–145 Hz) -> Crimson / Red / Orange
        Bass = 1,  // Basslines (105–300 Hz) -> Purple / Magenta / Acid Pink
        High = 2   // Highs / Leads (800–6500 Hz) -> Cyan / Mint / White
    }

    public enum EnemyTier
    {
        Tier1_Low = 1,
        Tier2_Mid = 2,
        Tier3_High = 3
    }

    public enum HitRating
    {
        None,
        Perfect,
        Good,
        Ok,
        Miss
    }

    [Serializable]
    public struct EnemyVariantData
    {
        public string name;
        public FrequencyBand band;
        public EnemyTier tier;
        public Color mainColor;
        public Color accentColor;
        public float scale;

        public EnemyVariantData(string name, FrequencyBand band, EnemyTier tier, Color mainColor, Color accentColor, float scale)
        {
            this.name = name;
            this.band = band;
            this.tier = tier;
            this.mainColor = mainColor;
            this.accentColor = accentColor;
            this.scale = scale;
        }
    }

    [Serializable]
    public class BeatNote
    {
        public float time; // in seconds from track start
        public Lane lane;
        public FrequencyBand band;
        public EnemyTier tier;
        public bool hit;
        public bool missed;

        public BeatNote(float time, Lane lane, FrequencyBand band, EnemyTier tier)
        {
            this.time = time;
            this.lane = lane;
            this.band = band;
            this.tier = tier;
            this.hit = false;
            this.missed = false;
        }
    }

    public static class EnemyRegistry
    {
        public static readonly EnemyVariantData Titan = new EnemyVariantData("Titan", FrequencyBand.Sub, EnemyTier.Tier1_Low, new Color(1f, 0.09f, 0.27f), new Color(1f, 0.54f, 0.5f), 1.15f);
        public static readonly EnemyVariantData Breaker = new EnemyVariantData("Breaker", FrequencyBand.Sub, EnemyTier.Tier2_Mid, new Color(1f, 0.24f, 0.35f), new Color(1f, 0.82f, 0.85f), 1.0f);
        public static readonly EnemyVariantData Rammer = new EnemyVariantData("Rammer", FrequencyBand.Sub, EnemyTier.Tier3_High, new Color(1f, 0.42f, 0.17f), new Color(1f, 0.82f, 0.5f), 0.96f);

        public static readonly EnemyVariantData Warlord = new EnemyVariantData("Warlord", FrequencyBand.Bass, EnemyTier.Tier1_Low, new Color(0.62f, 0.3f, 1f), new Color(0.88f, 0.77f, 1f), 1.08f);
        public static readonly EnemyVariantData Ronin = new EnemyVariantData("Ronin", FrequencyBand.Bass, EnemyTier.Tier2_Mid, new Color(0.85f, 0.3f, 1f), new Color(1f, 0.9f, 0f), 1.0f);
        public static readonly EnemyVariantData AcidDancer = new EnemyVariantData("Acid Dancer", FrequencyBand.Bass, EnemyTier.Tier3_High, new Color(1f, 0.31f, 0.85f), new Color(0.71f, 1f, 0.24f), 0.95f);

        public static readonly EnemyVariantData Speeder = new EnemyVariantData("Speeder", FrequencyBand.High, EnemyTier.Tier1_Low, new Color(0f, 0.9f, 1f), Color.white, 0.98f);
        public static readonly EnemyVariantData Wraith = new EnemyVariantData("Wraith", FrequencyBand.High, EnemyTier.Tier2_Mid, new Color(0.24f, 1f, 0.69f), new Color(0.82f, 1f, 0.94f), 1.0f);
        public static readonly EnemyVariantData Seraph = new EnemyVariantData("Seraph", FrequencyBand.High, EnemyTier.Tier3_High, new Color(0.78f, 0.97f, 1f), new Color(0.49f, 0.98f, 1f), 1.0f);

        public static EnemyVariantData GetVariant(FrequencyBand band, EnemyTier tier)
        {
            switch (band)
            {
                case FrequencyBand.Sub:
                    return tier == EnemyTier.Tier1_Low ? Titan : tier == EnemyTier.Tier2_Mid ? Breaker : Rammer;
                case FrequencyBand.Bass:
                    return tier == EnemyTier.Tier1_Low ? Warlord : tier == EnemyTier.Tier2_Mid ? Ronin : AcidDancer;
                case FrequencyBand.High:
                default:
                    return tier == EnemyTier.Tier1_Low ? Speeder : tier == EnemyTier.Tier2_Mid ? Wraith : Seraph;
            }
        }
    }
}
