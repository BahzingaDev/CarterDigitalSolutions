from ..schemas import SiteSummary


def get_site_summary() -> SiteSummary:
    return SiteSummary(
        title="Carter Digital Solutions",
        description="Freelance digital services for websites, software, workflow consultancy, and practical project delivery.",
        services=[
            "Professional websites",
            "Custom software and cloud platforms",
            "Workflow consultancy and support",
        ],
    )
