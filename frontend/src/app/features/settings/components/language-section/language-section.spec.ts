import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageSection } from './language-section';

describe('LanguageSection', () => {
  let component: LanguageSection;
  let fixture: ComponentFixture<LanguageSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LanguageSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
