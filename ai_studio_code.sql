SELECT u.id, u.full_name,
       COUNT(c.id) FILTER (WHERE c.status NOT IN ('Closed', 'Resolved')) AS active_case_count
FROM users u
LEFT JOIN cases c ON u.id = c.assigned_expert_id
WHERE u.role = 'CreditExpert' AND u.is_active = TRUE
GROUP BY u.id, u.full_name
ORDER BY active_case_count ASC, u.created_at ASC
LIMIT 1;