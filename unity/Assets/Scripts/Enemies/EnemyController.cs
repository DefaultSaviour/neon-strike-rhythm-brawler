using UnityEngine;
using NeonStrike.Core;
using NeonStrike.Audio;

namespace NeonStrike.Enemies
{
    public class EnemyController : MonoBehaviour
    {
        [Header("Runtime State")]
        public BeatNote Note { get; private set; }
        public EnemyVariantData Variant { get; private set; }
        public float TargetTime { get; private set; }
        public Lane Lane { get; private set; }
        public bool IsDefeated { get; private set; }

        [Header("Movement Settings")]
        [SerializeField] private float spawnDistance = 14f;
        [SerializeField] private float approachDuration = 1.6f; // seconds to travel from spawn to hit-zone

        [Header("Visual Components")]
        [SerializeField] private LineRenderer bodyRenderer;
        [SerializeField] private LineRenderer featureRenderer;
        [SerializeField] private ParticleSystem shatterParticles;

        private float speed;
        private float direction; // -1 for right incoming, +1 for left incoming

        public void Initialize(BeatNote note, float approachTime = 1.6f)
        {
            Note = note;
            Lane = note.lane;
            TargetTime = note.time;
            approachDuration = approachTime;
            speed = spawnDistance / approachDuration;
            direction = (Lane == Lane.Left) ? -1f : 1f;

            Variant = EnemyRegistry.GetVariant(note.band, note.tier);
            transform.localScale = Vector3.one * Variant.scale;

            SetupProceduralVisuals();
            UpdatePosition(AudioSyncEngine.Instance.GetSongTime());
        }

        private void SetupProceduralVisuals()
        {
            if (bodyRenderer == null)
            {
                bodyRenderer = gameObject.AddComponent<LineRenderer>();
                bodyRenderer.useWorldSpace = false;
                bodyRenderer.startWidth = 0.08f;
                bodyRenderer.endWidth = 0.08f;
                bodyRenderer.material = CreateGlowMaterial(Variant.mainColor);
            }

            bodyRenderer.startColor = Variant.mainColor;
            bodyRenderer.endColor = Variant.mainColor;

            // Simple humanoid wireframe loop (head, torso, legs)
            Vector3[] bodyPoints = new Vector3[]
            {
                new Vector3(0, 1.8f, 0),   // Top of head
                new Vector3(0.2f, 1.6f, 0),
                new Vector3(0, 1.4f, 0),   // Neck
                new Vector3(0, 0.7f, 0),   // Pelvis
                new Vector3(-0.3f, 0f, 0), // Left foot
                new Vector3(0, 0.7f, 0),   // Pelvis
                new Vector3(0.3f, 0f, 0),  // Right foot
                new Vector3(0, 1.2f, 0),   // Chest
                new Vector3(-0.4f, 1.0f, 0), // Left hand
                new Vector3(0, 1.2f, 0),   // Chest
                new Vector3(0.4f, 1.0f, 0), // Right hand
            };
            bodyRenderer.positionCount = bodyPoints.Length;
            bodyRenderer.SetPositions(bodyPoints);

            // Tier/Band specific accessory renderer
            if (featureRenderer == null)
            {
                GameObject featureObj = new GameObject("Feature");
                featureObj.transform.SetParent(transform, false);
                featureRenderer = featureObj.AddComponent<LineRenderer>();
                featureRenderer.useWorldSpace = false;
                featureRenderer.startWidth = 0.06f;
                featureRenderer.endWidth = 0.06f;
                featureRenderer.material = CreateGlowMaterial(Variant.accentColor);
            }

            featureRenderer.startColor = Variant.accentColor;
            featureRenderer.endColor = Variant.accentColor;

            SetupVariantFeature();
        }

        private void SetupVariantFeature()
        {
            if (featureRenderer == null) return;

            if (Variant.band == FrequencyBand.Sub)
            {
                // Horns / Shield for Sub heavies
                Vector3[] horns = new Vector3[]
                {
                    new Vector3(-0.35f, 2.0f, 0),
                    new Vector3(0f, 1.7f, 0),
                    new Vector3(0.35f, 2.0f, 0)
                };
                featureRenderer.positionCount = horns.Length;
                featureRenderer.SetPositions(horns);
            }
            else if (Variant.band == FrequencyBand.Bass)
            {
                // Katana / Banner for Bass samurai
                Vector3[] katana = new Vector3[]
                {
                    new Vector3(0.4f, 0.4f, 0),
                    new Vector3(0.7f, 1.6f, 0)
                };
                featureRenderer.positionCount = katana.Length;
                featureRenderer.SetPositions(katana);
            }
            else
            {
                // Wings / Halo for High speedsters
                Vector3[] wings = new Vector3[]
                {
                    new Vector3(-0.7f, 1.6f, 0),
                    new Vector3(0, 1.3f, 0),
                    new Vector3(0.7f, 1.6f, 0)
                };
                featureRenderer.positionCount = wings.Length;
                featureRenderer.SetPositions(wings);
            }
        }

        private Material CreateGlowMaterial(Color color)
        {
            Shader shader = Shader.Find("Sprites/Default");
            if (shader == null) shader = Shader.Find("Universal Render Pipeline/2D/Sprite-Lit-Default");
            if (shader == null) shader = Shader.Find("Unlit/Color");

            Material mat = new Material(shader);
            mat.color = color;
            return mat;
        }

        public void UpdatePosition(float currentSongTime)
        {
            if (IsDefeated) return;

            float timeRemaining = TargetTime - currentSongTime;
            // X position: at timeRemaining = approachDuration, X = direction * spawnDistance
            // at timeRemaining = 0, X = 0 (the player's hit line)
            float posX = direction * (timeRemaining * speed);
            transform.position = new Vector3(posX, 0f, 0f);

            // Running bob animation
            float bob = Mathf.Abs(Mathf.Sin(Time.time * 12f)) * 0.1f;
            transform.position += new Vector3(0, bob, 0);
        }

        public void OnHitDefeated(HitRating rating)
        {
            if (IsDefeated) return;
            IsDefeated = true;
            Note.hit = true;

            // Spawn neon shatter particles in enemy color
            CreateShatterEffect();

            Destroy(gameObject, 0.05f);
        }

        public void OnMissed()
        {
            if (IsDefeated) return;
            IsDefeated = true;
            Note.missed = true;

            // Fade out when running past player
            Destroy(gameObject, 0.3f);
        }

        private void CreateShatterEffect()
        {
            GameObject fx = new GameObject("ShatterFX");
            fx.transform.position = transform.position + Vector3.up * 1f;

            ParticleSystem ps = fx.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.startColor = Variant.mainColor;
            main.startSize = 0.15f;
            main.startSpeed = 6f;
            main.startLifetime = 0.45f;
            main.duration = 0.45f;
            main.loop = false;

            var emission = ps.emission;
            emission.rateOverTime = 0;
            emission.SetBursts(new ParticleSystem.Burst[] { new ParticleSystem.Burst(0f, 25) });

            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.3f;

            var renderer = fx.GetComponent<ParticleSystemRenderer>();
            renderer.material = CreateGlowMaterial(Variant.accentColor);

            ps.Play();
            Destroy(fx, 0.6f);
        }
    }
}
