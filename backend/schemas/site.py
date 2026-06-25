from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class SiteSummary:
    title: str
    description: str
    services: list[str]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
