import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorSection } from './editor-section';

describe('EditorSection', () => {
  let component: EditorSection;
  let fixture: ComponentFixture<EditorSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditorSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
