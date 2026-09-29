"""Validate the explicit IANS Analytics inclusion policy.
Run from the repository root: python3 checks/analytics-policy.py
"""
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path.cwd()
ANALYTICS_SRC = "/assets/js/ians-analytics.js"

INCLUDE = (
    "SameieNett.html",
    "academy/index.html",
    "academy/kilder.html",
    "academy/kontakt.html",
    "ai-infrastruktur.html",
    "boller.html",
    "dessert.html",
    "dns-sjekk.html",
    "galleri.html",
    "index.html",
    "ios-27.html",
    "ki-sikkerhet-kapplop.html",
    "ki-kritisk-infrastruktur.html",
    "en/ki-kritisk-infrastruktur.html",
    "en/ki-sikkerhet-kapplop.html",
    "en/teknologi-med-ansvar.html",
    "en/prosjekter.html",
    "en/plattformen.html",
    "en/veien-videre.html",
    "en/index.html",
    "iphone-50-tips.html",
    "iphone-compare.html",
    "kalender.html",
    "maimyra.html",
    "middag.html",
    "om-meg.html",
    "plattformen.html",
    "prosjekter.html",
    "sameienett-boliger.html",
    "sameienett-core.html",
    "sameienett-distribusjon.html",
    "sameienett-tjenester.html",
    "strom.html",
    "teknologi-med-ansvar.html",
    "veien-videre.html",
    "volvo-c40.html",
    "dk/SameieNett.html",
    "dk/index.html",
    "en/SameieNett.html",
    "fi/SameieNett.html",
    "fi/index.html",
    "is/SameieNett.html",
    "is/index.html",
    "se/SameieNett.html",
    "se/index.html",
    "tl/SameieNett.html",
    "tl/index.html",
    "games/index.html",
    "games/block-grid/index.html",
    "games/brick-breaker/index.html",
    "games/ian-the-adventure/index.html",
    "games/ians-orbit/index.html",
    "games/memory-grid/index.html",
    "games/moto-run/index.html",
    "games/neon-snake/index.html",
    "games/orbit-defender/index.html",
    "tools/chess-arena/index.html",
    "tools/dinner-planner/index.html",
    "tools/file-commander/index.html",
    "tools/money-planner/help.html",
    "tools/money-planner/index.html",
    "tools/money-planner/kids.html",
    "tools/money-planner/report.html",
    "tools/money-planner/resources.html",
    "tools/money-planner/sell.html",
    "tools/onedrive-organizer/cleanup.html",
    "tools/onedrive-organizer/command-center.html",
    "tools/onedrive-organizer/download.html",
    "tools/onedrive-organizer/duplicates.html",
    "tools/onedrive-organizer/explore.html",
    "tools/onedrive-organizer/media.html",
    "tools/onedrive-organizer/scan.html",
    "tools/onedrive-organizer/workspace.html",
    "tools/quiz-studio/index.html",
    "tools/website-builder-light/index.html",
    "tools/website-builder-pro/index.html",
)

EXCLUDE = (
    ".money-planner-backup/20260822-084754/tools/money-planner/index.html",
    ".money-planner-backup/20260822-091746/tools/money-planner/index.html",
    ".money-planner-backup/20260822-094337/tools/money-planner/index.html",
    ".money-planner-backup/20260822-094445/tools/money-planner/help.html",
    ".money-planner-backup/20260822-094445/tools/money-planner/index.html",
    ".money-planner-backup/20260822-094829/tools/money-planner/help.html",
    ".money-planner-backup/20260822-094829/tools/money-planner/index.html",
    ".money-planner-backup/20260822-100746/tools/money-planner/help.html",
    ".money-planner-backup/20260822-100746/tools/money-planner/index.html",
    ".money-planner-backup/20260822-101728/tools/money-planner/help.html",
    ".money-planner-backup/20260822-101728/tools/money-planner/index.html",
    ".money-planner-backup/20260822-101919/tools/money-planner/help.html",
    ".money-planner-backup/20260822-101919/tools/money-planner/index.html",
    ".money-planner-backup/20260822-102729/tools/money-planner/help.html",
    ".money-planner-backup/20260822-102729/tools/money-planner/index.html",
    ".money-planner-backup/20260822-105729/tools/money-planner/help.html",
    ".money-planner-backup/20260822-105729/tools/money-planner/index.html",
    ".money-planner-backup/20260822-110036/tools/money-planner/help.html",
    ".money-planner-backup/20260822-110036/tools/money-planner/index.html",
    ".money-planner-backup/20260822-110153/tools/money-planner/help.html",
    ".money-planner-backup/20260822-110153/tools/money-planner/index.html",
    "SameieNettold.html",
    "academy.html",
    "academy/academy.html",
    "academy/be-om-tilgang.html",
    "academy/boller.html",
    "academy/dessert.html",
    "academy/dns-sjekk.html",
    "academy/kapittel1.html",
    "academy/kapittel2.html",
    "academy/kapittel3.html",
    "academy/kapittel4.html",
    "academy/kapittel5.html",
    "academy/kids/family/foreldre.html",
    "academy/kids/family/index.html",
    "academy/kids/family/personvern.html",
    "academy/kids/index.html",
    "academy/kids/roblox/index.html",
    "academy/minenotater.html",
    "academy/ordliste.html",
    "academy/personvern.html",
    "academy/planner-program.html",
    "academy/quiz.html",
    "academy/vedtak-og-kilder.html",
    "booking-admin.html",
    "booking-personvern.html",
    "booking.html",
    "brannkontroll-admin.html",
    "brannkontroll-booking.html",
    "ians-analytics.html",
    "ians-booking.html",
    "om-megoo.html",
    "sameie-aarshjul-login.html",
    "sameie-aarshjul-tilgang.html",
    "sameie-aarshjul/index.html",
    "sameie-aarshjul/vedlikehold.html",
    "sameie-dashboard.html",
    "sameie-register.html",
    "sameie-registrer.html",
    "sameie-styretilgang.html",
    "sameie-tilgang-admin.html",
    "teknisk.html",
    "tools/money-planner/v01.html",
    "tools/money-planner/v02.html",
    "tools/money-planner/v03.html",
    "tools/money-planner/v04.html",
    "tools/onedrive-organizer/README.html",
    "tools/onedrive-organizer/auth-callback.html",
    "tools/onedrive-organizer/diagnostic.html",
    "tools/onedrive-organizer/index-legacy.html",
    "tools/onedrive-organizer/index.html",
    "tools/onedrive-organizer/reset.html",
)


class AnalyticsTags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.count = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return
        src = dict(attrs).get("src", "")
        if src.split("?", 1)[0] == ANALYTICS_SRC:
            self.count += 1


def main():
    include = set(INCLUDE)
    exclude = set(EXCLUDE)
    errors = []

    if len(include) != len(INCLUDE):
        errors.append("INCLUDE manifest contains duplicate entries")
    if len(exclude) != len(EXCLUDE):
        errors.append("EXCLUDE manifest contains duplicate entries")
    overlap = include & exclude
    if overlap:
        errors.append(f"Pages appear in both manifests: {', '.join(sorted(overlap))}")

    actual = {
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*.html")
        if ".git" not in path.parts
    }
    manifest = include | exclude

    for name in sorted(manifest - actual):
        errors.append(f"Manifest page does not exist: {name}")
    for name in sorted(actual - manifest):
        errors.append(f"Unclassified HTML page: {name}")

    for name in sorted(actual & manifest):
        parser = AnalyticsTags()
        parser.feed((ROOT / name).read_text(encoding="utf-8"))
        if parser.count > 1:
            errors.append(f"{name}: contains Analytics {parser.count} times")
        if name in include and parser.count != 1:
            errors.append(f"{name}: INCLUDE page must contain Analytics exactly once")
        if name in exclude and parser.count:
            errors.append(f"{name}: EXCLUDE page must not contain Analytics")

    print(
        f"{len(actual)} HTML files classified: "
        f"{len(include)} INCLUDE, {len(exclude)} EXCLUDE."
    )
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("PASS: Analytics script usage matches the explicit policy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
