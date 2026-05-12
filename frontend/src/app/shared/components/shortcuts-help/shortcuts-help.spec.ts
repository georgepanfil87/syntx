import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShortcutsHelp } from './shortcuts-help';

describe('ShortcutsHelp', () => {
  let component: ShortcutsHelp;
  let fixture: ComponentFixture<ShortcutsHelp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShortcutsHelp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShortcutsHelp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
