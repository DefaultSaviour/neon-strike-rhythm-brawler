using UnityEngine;
using NeonStrike.Core;
using NeonStrike.Game;

namespace NeonStrike.VFX
{
    public class CameraShake : MonoBehaviour
    {
        public static CameraShake Instance { get; private set; }

        private Vector3 initialPosition;
        private float shakeTrauma = 0f;
        [SerializeField] private float traumaDecay = 3.5f;
        [SerializeField] private float maxShakeOffset = 0.25f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            initialPosition = transform.localPosition;
        }

        private void Start()
        {
            if (RhythmCombatManager.Instance != null)
            {
                RhythmCombatManager.Instance.OnHitEvaluated += HandleHitEvaluated;
            }
        }

        private void OnDestroy()
        {
            if (RhythmCombatManager.Instance != null)
            {
                RhythmCombatManager.Instance.OnHitEvaluated -= HandleHitEvaluated;
            }
        }

        private void HandleHitEvaluated(HitRating rating, Lane lane)
        {
            if (rating == HitRating.Perfect)
            {
                AddTrauma(0.5f);
            }
            else if (rating == HitRating.Good)
            {
                AddTrauma(0.28f);
            }
        }

        public void AddTrauma(float amount)
        {
            shakeTrauma = Mathf.Clamp01(shakeTrauma + amount);
        }

        private void Update()
        {
            if (shakeTrauma > 0f)
            {
                float shake = shakeTrauma * shakeTrauma; // non-linear shake curve
                float offsetX = (Mathf.PerlinNoise(Time.time * 25f, 0f) * 2f - 1f) * maxShakeOffset * shake;
                float offsetY = (Mathf.PerlinNoise(0f, Time.time * 25f) * 2f - 1f) * maxShakeOffset * shake;

                transform.localPosition = initialPosition + new Vector3(offsetX, offsetY, 0f);
                shakeTrauma = Mathf.MoveTowards(shakeTrauma, 0f, Time.deltaTime * traumaDecay);
            }
            else
            {
                transform.localPosition = initialPosition;
            }
        }
    }
}
