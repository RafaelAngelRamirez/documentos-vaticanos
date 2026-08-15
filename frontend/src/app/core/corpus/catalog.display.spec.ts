import {
  displayTitle,
  familyKey,
  filterByTab,
  kindFromName,
  liveTabs,
  preferredEdition,
  provenanceBadge,
  tabForKind,
} from './catalog.display';

describe('catalog.display', () => {
  it('classifies by name, not *-es ids', () => {
    expect(kindFromName('Catecismo')).toBe('catechism');
    expect(kindFromName('Biblia')).toBe('bible');
    expect(kindFromName('Concilio de Nicea')).toBe('council');
    expect(kindFromName('dv-en', 'council')).toBe('council');
  });

  it('maps Vat. II twins and councils to Concilios', () => {
    expect(tabForKind(kindFromName('Concilio Vaticano II'))).toBe('Concilios');
    expect(tabForKind('council')).toBe('Concilios');
    expect(tabForKind('canon-law')).toBe('Derecho');
    expect(tabForKind('encyclical')).toBe('Magisterio');
  });

  it('familyKey strips locale suffix', () => {
    expect(familyKey('dv-es')).toBe('dv');
    expect(familyKey('dv-ar')).toBe('dv');
    expect(familyKey('catecismo')).toBe('catecismo');
  });

  it('prefers contentLocale twin over hardcoded -es', () => {
    const eds = [
      { id: 'atanasio-de-incarnatione-es', locale: 'es' },
      { id: 'atanasio-de-incarnatione-en', locale: 'en' },
    ];
    expect(preferredEdition(eds, 'en')?.id).toBe(
      'atanasio-de-incarnatione-en'
    );
  });

  it('displayTitle prefers full title over shortTitle', () => {
    expect(
      displayTitle({ title: 'Laudato Si\'', shortTitle: 'LS', nombre: 'x' })
    ).toBe('Laudato Si\'');
  });

  it('provenanceBadge marks IA and non-ES', () => {
    expect(provenanceBadge({ locale: 'es', translationProvenance: 'ai' })).toBe(
      'ES(IA)'
    );
    expect(provenanceBadge({ locale: 'la' })).toBe('LA');
  });

  it('liveTabs hides empty Encíclicas-style tabs', () => {
    const items = [
      { kind: 'catechism' as const },
      { kind: 'bible' as const },
    ];
    expect(liveTabs(items)).toEqual(['Todos', 'Catecismo', 'Escritura']);
    expect(filterByTab(items, 'Catecismo').length).toBe(1);
  });
});
