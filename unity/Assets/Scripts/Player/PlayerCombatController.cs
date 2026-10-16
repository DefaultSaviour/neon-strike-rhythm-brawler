using UnityEngine;
using NeonStrike.Core;

namespace NeonStrike.Player
{
    public class PlayerCombatController : MonoBehaviour
    {
        [Header("Components")]
        [SerializeField] private LineRenderer bodyRenderer;
        [SerializeField] private LineRenderer scarfRenderer;
        [SerializeField] private LineRenderer wingRenderer;
        [SerializeField] private LineRenderer groundRingRenderer;
        [SerializeField] private LineRenderer bladeSlashRenderer;

        [Header("Colors")]
        [SerializeField] private Color cyanGlow = new Color(0f, 0.95f, 1f);
        [SerializeField] private Color pinkGlow = new Color(1f, 0f, 0.5f);
        [SerializeField] private Color wingColor = Color.white;
        [SerializeField] private Color lightningColor = new Color(1f, 0.9f, 0f);

        private Lane lastAttackLane = Lane.Left;
        private bool isAttacking = false;
        private float attackTimer = 0f;
        private int currentCombo = 0;

        private void Awake()
        {
            SetupPlayerComponents();
        }

        private void SetupPlayerComponents()
        {
            if (bodyRenderer == null)
            {
                bodyRenderer = gameObject.AddComponent<LineRenderer>();
                bodyRenderer.useWorldSpace = false;
                bodyRenderer.startWidth = 0.09f;
                bodyRenderer.endWidth = 0.09f;
                bodyRenderer.material = CreateMaterial(cyanGlow);
            }

            if (scarfRenderer == null)
            {
                GameObject scarfObj = new GameObject("Scarf");
                scarfObj.transform.SetParent(transform, false);
                scarfRenderer = scarfObj.AddComponent<LineRenderer>();
                scarfRenderer.useWorldSpace = false;
                scarfRenderer.startWidth = 0.07f;
                scarfRenderer.endWidth = 0.03f;
                scarfRenderer.material = CreateMaterial(pinkGlow);
            }

            if (groundRingRenderer == null)
            {
                GameObject ringObj = new GameObject("GroundAura");
                ringObj.transform.SetParent(transform, false);
                groundRingRenderer = ringObj.AddComponent<LineRenderer>();
                groundRingRenderer.useWorldSpace = false;
                groundRingRenderer.startWidth = 0.05f;
                groundRingRenderer.endWidth = 0.05f;
                groundRingRenderer.loop = true;
                groundRingRenderer.material = CreateMaterial(cyanGlow);
                groundRingRenderer.enabled = false;
            }

            if (wingRenderer == null)
            {
                GameObject wingObj = new GameObject("PlasmaWings");
                wingObj.transform.SetParent(transform, false);
                wingRenderer = wingObj.AddComponent<LineRenderer>();
                wingRenderer.useWorldSpace = false;
                wingRenderer.startWidth = 0.08f;
                wingRenderer.endWidth = 0.08f;
                wingRenderer.material = CreateMaterial(wingColor);
                wingRenderer.enabled = false;
            }

            if (bladeSlashRenderer == null)
            {
                GameObject slashObj = new GameObject("BladeSlash");
                slashObj.transform.SetParent(transform, false);
                bladeSlashRenderer = slashObj.AddComponent<LineRenderer>();
                bladeSlashRenderer.useWorldSpace = false;
                bladeSlashRenderer.startWidth = 0.12f;
                bladeSlashRenderer.endWidth = 0.02f;
                bladeSlashRenderer.material = CreateMaterial(cyanGlow);
                bladeSlashRenderer.enabled = false;
            }

            SetIdlePose();
        }

        private Material CreateMaterial(Color color)
        {
            Shader shader = Shader.Find("Sprites/Default");
            if (shader == null) shader = Shader.Find("Unlit/Color");
            Material mat = new Material(shader);
            mat.color = color;
            return mat;
        }

        public void Strike(Lane lane, int combo)
        {
            currentCombo = combo;
            lastAttackLane = lane;
            isAttacking = true;
            attackTimer = 0.15f;

            float dir = (lane == Lane.Left) ? -1f : 1f;

            // Attack Pose: snappy martial arts strike
            Vector3[] attackPoints = new Vector3[]
            {
                new Vector3(dir * 0.15f, 1.75f, 0), // Head
                new Vector3(dir * 0.1f, 1.4f, 0),  // Neck
                new Vector3(0, 0.7f, 0),           // Pelvis
                new Vector3(-dir * 0.4f, 0f, 0),   // Back foot
                new Vector3(0, 0.7f, 0),           // Pelvis
                new Vector3(dir * 0.5f, 0f, 0),    // Front foot (braced)
                new Vector3(dir * 0.15f, 1.2f, 0), // Chest
                new Vector3(-dir * 0.2f, 1.3f, 0), // Guard hand
                new Vector3(dir * 0.15f, 1.2f, 0), // Chest
                new Vector3(dir * 1.1f, 1.25f, 0)  // Striking fist extended forward!
            };
            bodyRenderer.positionCount = attackPoints.Length;
            bodyRenderer.SetPositions(attackPoints);

            // Blade slash arc
            bladeSlashRenderer.enabled = true;
            bladeSlashRenderer.positionCount = 5;
            bladeSlashRenderer.SetPositions(new Vector3[]
            {
                new Vector3(dir * 0.3f, 1.7f, 0),
                new Vector3(dir * 0.7f, 1.5f, 0),
                new Vector3(dir * 1.2f, 1.2f, 0),
                new Vector3(dir * 0.9f, 0.7f, 0),
                new Vector3(dir * 0.5f, 0.4f, 0)
            });

            UpdateComboVisuals(combo);
        }

        private void SetIdlePose()
        {
            Vector3[] idlePoints = new Vector3[]
            {
                new Vector3(0, 1.8f, 0),   // Head
                new Vector3(0, 1.4f, 0),   // Neck
                new Vector3(0, 0.7f, 0),   // Pelvis
                new Vector3(-0.3f, 0f, 0), // Left foot
                new Vector3(0, 0.7f, 0),   // Pelvis
                new Vector3(0.3f, 0f, 0),  // Right foot
                new Vector3(0, 1.2f, 0),   // Chest
                new Vector3(-0.35f, 1.25f, 0), // Guard left
                new Vector3(0, 1.2f, 0),   // Chest
                new Vector3(0.35f, 1.25f, 0)   // Guard right
            };
            bodyRenderer.positionCount = idlePoints.Length;
            bodyRenderer.SetPositions(idlePoints);

            bladeSlashRenderer.enabled = false;
        }

        public void UpdateComboVisuals(int combo)
        {
            currentCombo = combo;

            // 1. Ground Aura Ring (Combo 6+)
            if (combo >= 6)
            {
                groundRingRenderer.enabled = true;
                int segments = 24;
                Vector3[] ringPoints = new Vector3[segments];
                float radius = 0.8f + Mathf.Min(0.6f, combo * 0.01f);
                for (int i = 0; i < segments; i++)
                {
                    float rad = (i / (float)segments) * Mathf.PI * 2f;
                    ringPoints[i] = new Vector3(Mathf.Cos(rad) * radius, Mathf.Sin(rad) * (radius * 0.35f), 0);
                }
                groundRingRenderer.positionCount = segments;
                groundRingRenderer.SetPositions(ringPoints);
            }
            else
            {
                groundRingRenderer.enabled = false;
            }

            // 2. Radiant Plasma Wings (Combo 50+)
            if (combo >= 50)
            {
                wingRenderer.enabled = true;
                float spread = 0.2f * Mathf.Sin(Time.time * 6f);
                Vector3[] wings = new Vector3[]
                {
                    new Vector3(-1.8f - spread, 2.2f, 0),
                    new Vector3(-0.2f, 1.2f, 0),
                    new Vector3(0.2f, 1.2f, 0),
                    new Vector3(1.8f + spread, 2.2f, 0),
                    new Vector3(0.2f, 1.2f, 0),
                    new Vector3(1.4f + spread, 1.1f, 0),
                    new Vector3(-0.2f, 1.2f, 0),
                    new Vector3(-1.4f - spread, 1.1f, 0)
                };
                wingRenderer.positionCount = wings.Length;
                wingRenderer.SetPositions(wings);
            }
            else
            {
                wingRenderer.enabled = false;
            }
        }

        private void Update()
        {
            // Scarf fluttering in wind
            float wave = Mathf.Sin(Time.time * 8f) * 0.15f;
            Vector3[] scarf = new Vector3[]
            {
                new Vector3(0, 1.4f, 0),
                new Vector3(-0.3f, 1.35f + wave * 0.5f, 0),
                new Vector3(-0.6f, 1.25f + wave, 0),
                new Vector3(-0.95f, 1.1f + wave * 1.5f, 0)
            };
            scarfRenderer.positionCount = scarf.Length;
            scarfRenderer.SetPositions(scarf);

            // Return to idle after attack
            if (isAttacking)
            {
                attackTimer -= Time.deltaTime;
                if (attackTimer <= 0f)
                {
                    isAttacking = false;
                    SetIdlePose();
                }
            }

            // Keep wings fluttering if active
            if (currentCombo >= 50)
            {
                UpdateComboVisuals(currentCombo);
            }
        }
    }
}
